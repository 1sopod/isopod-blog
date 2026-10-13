---
title: 'HTB Sherlock: Bumblebee'
description: 'DFIR on a compromised phpBB forum: an external contractor phishes admin credentials with a malicious post, escalates through the ACP, and exfiltrates a database backup.'
pubDate: 2023-04-26
platform: 'HackTheBox'
category: 'Sherlock'
os: 'Linux'
difficulty: 'Easy'
retired: true
tags: ['htb', 'sherlock', 'dfir', 'phpbb', 'sqlite', 'log-analysis']
---

## Scenario

An external contractor accessed the internal Forela forum over the guest Wi-Fi and
appears to have stolen credentials for the administrative user. We were given the forum
logs and a full database dump in SQLite3 format to investigate.

**Key hosts and identities**

- **Forum:** Forela internal phpBB (`forum.forela.co.uk`) at `10.10.0.27`
- **Legit admin:** `phpbb-admin` (user 48), logs in from `10.255.254.2`, user agent Mac Chrome 112
- **Attacker:** Alex Poole, external contractor on guest Wi-Fi, source `10.10.0.78`, user agent Windows Firefox

## Working with the SQLite dump

A few habits made the database dump much easier to read:

- Set the output mode before querying: `.headers on` then `.mode column` for tables,
  `.mode line` for long text (posts), `.mode json` for scripts.
- Never `SELECT *` on `phpbb_users` — `user_permissions` (binary blob) and `user_email_hash`
  are noise. Pick only the columns you need.
- Every phpBB timestamp is a Unix epoch. Convert it inline:
  `datetime(user_regdate, 'unixepoch')`.
- Filter out bots with `user_type <> 2` (2 = bot, 0 = normal, 3 = founder).

The tables that mattered:

- `phpbb_users` — `user_id`, `username`, `user_ip`, `user_regdate`
- `phpbb_log` — the admin audit trail: `log_time` (epoch), `log_ip`, `log_operation`, `log_data`
- `phpbb_config` — LDAP settings, including `ldap_password` in plaintext
- `phpbb_posts` — `post_id`, `poster_ip`, `post_time`, `post_text`
- `phpbb_groups` — `group_id` 5 = administrators

## Task 1 — The contractor's username

Two accounts were registered from the attacker IP:

- `apoole` (user 51), `contractor.net`, registered `2023-04-25 11:08:19`
- `apoole1` (user 52), `contractor.net`, registered `2023-04-25 12:15:41`

Both came from `10.10.0.78`. The first is the answer: **`apoole`**.

## Task 2 — Account creation IP

**`10.10.0.78`** — the guest Wi-Fi address tied to both registrations.

## Task 3 — The malicious post

The second account posted **`post_id` 9**. Behind an innocent "Greetings everyone"
message, the post body smuggled in HTML and JavaScript:

```html
<span>Greetings everyone,<br><br>
I am just a visiting IT Contractor, it's a fantastic company y'all have here.<br>
I hope to work with you all again soon.<br><br>
Regards,<br>Alex Poole</span>
```

The injected markup rendered a fake "session timeout" login modal (a hidden iframe)
that captured whatever an admin typed into it.

## Task 4 — The credential stealer's URI

The fake login form POSTed its captured credentials to:

```
http://10.10.0.78/update.php
```

## Task 5 — When the contractor logged in as admin

Filtering the admin audit log for the attacker IP rather than just the operation
is what separates the real event from the decoy:

```sql
SELECT user_id, log_operation, log_time
FROM phpbb_log
WHERE log_ip = '10.10.0.78';
```

![phpbb_log entries from the attacker IP](/images/writeups/bumblebee/acp-log.png)

The `LOG_ADMIN_AUTH_SUCCESS` entry has epoch `1682506392`, which is
**2023-04-26 10:53:12 UTC**. (The other auth success, at 11:09:07, was the legit admin
from `10.255.254.2` — don't confuse the two.)

## Task 6 — Plaintext LDAP password

When the admin switched authentication to LDAP, the bind credentials landed in
`phpbb_config` in plaintext:

![phpbb_config schema](/images/writeups/bumblebee/ldap-config.png)

```
ldap_password   Passw0rd1
```

**`Passw0rd1`**.

## Task 7 — Administrator user agent

```
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36
```

## Task 8 — Adding themselves to the Administrator group

The `LOG_USERS_ADDED` entry (epoch `1682506431`) records `apoole` being added to the
`administrators` group at **2023-04-26 10:53:51 UTC** — 39 seconds after the ACP login.

## Task 9 — Downloading the database backup

The backup was created through the ACP, then pulled straight from `/store/` over HTTP:

```bash
grep "26/Apr/2023:1[0-2]" access.log | grep "backup" | grep ".sql"
```

```
10.10.0.78 - - [26/Apr/2023:12:01:38 +0100] "GET /store/backup_1682506471_dcsr71p7fyijoyq8.sql.gz HTTP/1.1" 200 34707 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0"
```

Apache logs local time (`+0100`), so `12:01:38 +0100` is **2023-04-26 11:01:38 UTC**.

## Task 10 — Backup size

In the combined log line, the field right after the status code is the response size:
**34707 bytes**.

## Attack chain

| Time (UTC) | Event |
| --- | --- |
| 2023-04-24 16:17 | Admin changes registration settings and forum ACL |
| 2023-04-25 11:08:19 | Contractor registers `apoole` (user 51) from `10.10.0.78` |
| 2023-04-25 11:09:07 | Legit admin logs in, resets `apoole`'s password — contractor locked out |
| 2023-04-25 11:46–11:48 | Admin enables LDAP ext and switches auth → LDAP creds land in `phpbb_config` plaintext |
| 2023-04-25 12:15:41 | Contractor registers `apoole1` (user 52) |
| 2023-04-25 12:17:22 | `apoole1` posts the malicious post (`post_id` 9) with the fake login modal |
| later | An admin views the post → credentials harvested to `10.10.0.78/update.php` |
| 2023-04-26 10:53:12 | Contractor logs into the ACP as `phpbb-admin` with stolen creds |
| 2023-04-26 10:53:51 | Adds `apoole` to the `administrators` group |
| 2023-04-26 10:54:31 | Creates a DB backup via the ACP |
| 2023-04-26 11:01:38 | Downloads the backup (34,707 bytes) from `/store/` |
| 2023-04-26 11:01:52 | Logs out |

## Lessons learned

**The session-ID trap (Tasks 5 and 9).** A SID found in a log line is not automatically
the attacker's. Cross-check `phpbb_sessions.session_user_id` — `1` is anonymous. The
`be3cc6e2…` SID was just the anonymous homepage load right after logout, not tampering.
The real ACP session (`eca30c1…`) is the one to follow across the log.

**Timestamps come in two flavours.** Apache combined logs are local time with an offset
you must subtract for UTC. phpBB `log_time` is already a UTC epoch — no offset math. In a
combined log line the fields are: IP, `-`, `-`, `[time]`, `"request"`, status, **bytes**,
`"referer"`, `"user-agent"` — the size is the field right after the status code.

**Defensive takeaways.** Initial access was guest Wi-Fi plus open registration plus a
stored-credential phish on the forum itself. Privilege escalation was the stolen admin
creds driving the ACP. Exfiltration was a database backup downloaded over plain HTTP from
`/store/`. The LDAP bind credentials were exposed in plaintext — rotate them, and reset
any account that viewed the malicious post.
