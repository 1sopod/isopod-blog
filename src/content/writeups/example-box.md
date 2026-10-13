---
title: 'HTB: Example (sample writeup)'
description: 'A sample writeup showing the layout. Delete this once you publish your first real one.'
pubDate: 2026-10-12
platform: 'HackTheBox'
category: 'Machine'
os: 'Linux'
difficulty: 'Easy'
retired: true
tags: ['htb', 'linux', 'web']
---

This is placeholder content showing how a writeup renders. Copy `_template.md` to start a real one.

## Overview

A short summary of the box and the path to root.

## Recon

```bash
nmap -sC -sV -oA nmap/initial 10.10.10.10
```

```text
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1
80/tcp open  http    nginx 1.18.0
```

### Web enumeration

Notes on what you found and why it mattered.

## Foothold

How you got a shell.

## Privilege escalation

How you got root.

## Lessons learned

What you'd do differently, and what defenders should fix.
