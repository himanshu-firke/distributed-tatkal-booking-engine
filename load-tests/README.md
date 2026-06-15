# Load Tests — Phase 6 Execution Guide

## What You Need

| Tool | Purpose | Install |
|---|---|---|
| MongoDB 7 | Database for monolith | See Step 1 below |
| Node.js 20 | Already installed | - |
| k6 | Load testing tool | See Step 2 below |

---

## Step 1 — Install MongoDB

### Option A: MongoDB Community Edition (Recommended)
1. Go to: https://www.mongodb.com/try/download/community
2. Select: **Version 7.0**, **Platform: Windows**, **Package: msi**
3. Download and run the installer
4. Check ✅ "Install MongoDB as a Service" during installation
5. MongoDB will auto-start on port 27017

### Verify MongoDB is running:
```powershell
# In PowerShell
Get-Service MongoDB
# Should show: Running
```

---

## Step 2 — Install k6

```powershell
# In PowerShell (as Administrator)
winget install k6 --source winget
```

Or download from: https://dl.k6.io/msi/k6-latest-amd64.msi

### Verify:
```powershell
k6 version
# Should show: k6 v0.x.x ...
```

---

## Step 3 — Setup Monolith

```powershell
# 1. Copy environment file
cd "c:\scale projects\irctc_tatkal_machine\monolith"
Copy-Item .env.example .env

# 2. Install dependencies (already done but just in case)
npm install
```

---

## Step 4 — Seed the Database

```powershell
cd "c:\scale projects\irctc_tatkal_machine\monolith"
npm run seed
```

**IMPORTANT: Copy the Train ID from output!**
```
[Seed] Train ID: 6846a1234567890abcdef123    ← COPY THIS
```

You will need this for Scenarios B, C, and D.

---

## Step 5 — Start the Monolith Server

Open a **NEW terminal window** and keep it open:

```powershell
cd "c:\scale projects\irctc_tatkal_machine\monolith"
npm run dev
```

You should see:
```
[Monolith] Server running on port 3000
[DB] MongoDB connected
```

**Take a screenshot of this terminal — it's your baseline.**

---

## Step 6 — Run The Scenarios

Open **another NEW terminal** for k6. Keep the server terminal open to watch logs.

### Scenario A — Auth CPU Starvation
```powershell
cd "c:\scale projects\irctc_tatkal_machine"
k6 run load-tests/scenario-a-auth-stress.js
```
**What to watch:** Server terminal will slow down. k6 p99 will spike.
**Screenshot when:** k6 shows high latency or ✗ failures.

---

### Scenario B — MongoDB Pool Saturation
```powershell
k6 run -e TRAIN_ID=<YOUR_TRAIN_ID> load-tests/scenario-b-seat-storm.js
```
Replace `<YOUR_TRAIN_ID>` with the ID from Step 4.

**What to watch:** k6 latency p99 climbing. Server logs showing slow queries.

---

### Scenario C — Booking Race Condition (THE BIG ONE)

**First, reseed to reset to 500 seats:**
```powershell
cd "c:\scale projects\irctc_tatkal_machine\monolith"
npm run seed
```
**Copy the NEW Train ID!**

```powershell
cd "c:\scale projects\irctc_tatkal_machine"
k6 run -e TRAIN_ID=<YOUR_NEW_TRAIN_ID> load-tests/scenario-c-booking-race.js
```

**After k6 finishes, verify the race condition:**
```powershell
node load-tests/verify-race-result.js
```

**Screenshot the verify output — this is your proof of data corruption.**

---

### Scenario D — Full Tatkal Cascade (Combined)

**Reseed again before this:**
```powershell
cd "c:\scale projects\irctc_tatkal_machine\monolith"
npm run seed
```

```powershell
cd "c:\scale projects\irctc_tatkal_machine"
k6 run -e TRAIN_ID=<YOUR_TRAIN_ID> load-tests/scenario-d-tatkal-combined.js
```

---

## Screenshots to Take

| When | What to screenshot |
|---|---|
| After `npm run dev` starts | Clean server terminal |
| During Scenario A at peak VU | k6 terminal showing latency spike |
| End of Scenario A | k6 summary table |
| End of Scenario B | k6 summary showing errors |
| End of Scenario C k6 | k6 summary |
| After `verify-race-result.js` | The verification output showing oversold seats |
| End of Scenario D | k6 terminal showing all three failures together |

Save all screenshots to: `load-tests/screenshots/`

---

## Results Directory

After running, save k6 JSON output too:

```powershell
# Save raw results to JSON for later analysis
k6 run --out json=load-tests/results/scenario-a.json load-tests/scenario-a-auth-stress.js
k6 run --out json=load-tests/results/scenario-b.json -e TRAIN_ID=<ID> load-tests/scenario-b-seat-storm.js
k6 run --out json=load-tests/results/scenario-c.json -e TRAIN_ID=<ID> load-tests/scenario-c-booking-race.js
```
