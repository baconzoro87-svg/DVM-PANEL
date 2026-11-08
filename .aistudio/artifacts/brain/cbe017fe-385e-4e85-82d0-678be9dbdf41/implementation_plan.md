# DVM Panel — Complete BusterNodes Upgrade & Production Infrastructure Plan

DVM Panel for BusterNodes is being upgraded into a complete, commercial-grade containerized VPS management platform. This blueprint details the removal of legacy Gemini dependencies, the implementation of end-to-end authentication with role-based access control, the AutoDeploy slot management subsystem, interactive browser root console with xterm.js and WebSockets, SSHX session sharing, container lifecycle operations (including reinstall and real startup logs), and non-systemd deployment automation via `install.sh` and `run.sh`.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX choices have been confirmed and are locked for execution:
> - **Interactive Root Console**: Real-time WebSocket terminal utilizing `xterm.js` and server-side container execution (`docker exec` or pseudo-terminal relay) attached directly to the user's container as root.
> - **SSHX Terminal Integration**: Placed directly below the web console; triggers SSHX inside the target container to generate a live, shareable terminal session URL without exposing the host system.
> - **AutoDeploy Policy**: Administrators configure global capacity, resource limits, and manually assign available slots; users can only deploy instances when allocated an available slot.
> - **Gemini API Purge**: All `@google/genai` packages, API keys, and environment references are completely removed.
> - **Authentication & Default Account**: Default admin initialized with `admin@dvm.io` / `Admin213` with forced password change upon initial login; standard user signup/login with secure SHA-256/bcrypt-compatible hashing and session tokens.

---

## 1. Overview & Core Concept

- **What It Does**: A high-performance, dark-themed VPS and container orchestration platform providing self-service container management for users and full fleet control for administrators.
- **Target Audience**: Cloud hosting administrators, DevOps engineers, and server users requiring dedicated container instances with root terminal access and automated slot distribution.
- **Brand & Theme**: **DVM Panel** by **BusterNodes** (Developer credit: *Made by Azmal*), utilizing a deep obsidian (#090A0F) and dark charcoal background with rich maroon/rose accents (#BE123C / #9F1239).

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Authentication Flow**:
   - Unauthenticated visitors land on `/login` or `/signup`.
   - Existing users enter email and password; upon successful authentication, JWT/session cookie is stored.
   - Initial admin login (`admin@dvm.io` / `Admin213`) prompts a mandatory "Change Default Password" modal before granting panel access.
   - Navigation adapts dynamically based on role (`admin` vs `user`).
2. **User VPS Dashboard Flow**:
   - "My VPS Instances" lists only the containers owned by the authenticated user.
   - Detailed VPS View displays hardware metrics (vCPU, RAM, SSD), public IP, allocated SSH port, and container status.
   - Lifecycle controls (Start, Stop, Restart, Reinstall) provide real-time status feedback.
   - Tabbed console area features the **Interactive Web Console (xterm.js)** and the **SSHX Terminal** generator button.
3. **Admin AutoDeploy & Fleet Management Flow**:
   - Admin navigates to **AutoDeploy Settings** to toggle deployment availability, configure slot limits (total, occupied, available), and customize default hardware constraints per slot.
   - Admin manages registered users (view, suspend, allocate slots, delete).
   - Admin provisions VPS instances and assigns them to specific user slots.
   - When slots are exhausted or AutoDeploy is toggled OFF, users attempting deployment receive a clear notice requesting admin slot allocation.

### Visual Architecture & Typography
- **Theme**: Obsidian slate (`#090A0F`), deep maroon panels (`#111219`), hairline borders (`border-white/5` and `border-rose-950/60`), and focused rose accents (`#BE123C`).
- **Typography**: Clean sans hierarchy (`Plus Jakarta Sans` / `Outfit`) paired with tabular monospace numerals (`JetBrains Mono` / `tabular-nums`) for IPs, ports, metrics, and terminal feeds.
- **Anti-Slop Discipline**: Zero pseudo-technical code-comment headers, zero decorative pulsing dots, zero pill sandwiches, and zero fabricated performance claims.

---

## 3. Key Product Decisions & Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          DVM Panel Client                              │
│   (React 19 + Tailwind v4 + Lucide Icons + xterm.js Terminal Canvas)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST & WebSocket (ws://)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Express 4 + Node.js Engine                       │
│  ┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────┐ │
│  │   Auth & Session      │ │  AutoDeploy Slots │ │  Container Exec   │ │
│  │  (JWT / SQLite Hash)  │ │   Engine & Limits │ │  & PTY WebSocket  │ │
│  └───────────────────────┘ └───────────────────┘ └───────────────────┘ │
└──────────────────┬─────────────────┬─────────────────┬─────────────────┘
                   │                 │                 │
┌──────────────────▼──────┐ ┌────────▼────────┐ ┌──────▼─────────────────┐
│     SQLite Database     │ │ Docker Engine   │ │     SSHX Daemon        │
│  (Users, VMs, Slots,    │ │ (/var/run/      │ │  (In-container root    │
│   Settings, API Keys)   │ │  docker.sock)   │ │   ephemeral session)   │
└─────────────────────────┘ └─────────────────┘ └────────────────────────┘
```

### Component & System Specifications

#### 1. Gemini Removal
- Remove `@google/genai` from `package.json`.
- Strip Gemini references from `metadata.json`, `.env.example`, and server configuration.
- Retain lightweight, self-contained architecture with zero external LLM dependencies.

#### 2. Authentication & Admin Security Subsystem
- **User Database Schema**:
  - `id` (UUID)
  - `email` (Unique, normalized lowercase)
  - `password_hash` (Salted SHA-256 / PBKDF2)
  - `role` (`'admin'` or `'user'`)
  - `status` (`'active'` or `'suspended'`)
  - `must_change_password` (Integer: `1` for default admin, `0` otherwise)
  - `assigned_slots` (Integer: number of VPS slots allocated to this user)
  - `created_at`
- **Initial Admin Seeding**: Default user `admin@dvm.io` initialized with `Admin213` and `must_change_password = 1`.
- **Session Middleware**: Authenticates token via HTTP headers / cookies; verifies active status; denies unauthorized cross-user operations.

#### 3. AutoDeploy & Slot Management Subsystem
- **Settings Store**:
  - `autodeploy_enabled`: boolean string (`"true"` | `"false"`)
  - `total_slots`: integer (e.g. `20`)
  - `slot_default_cpu`: integer
  - `slot_default_ram_mb`: integer
  - `slot_default_disk_gb`: integer
  - `allowed_templates`: JSON array of verified OS tags
- **Slot Allocation Policy**:
  - Available slots calculated dynamically: $\text{Available} = \text{Total Slots} - \text{Occupied Slots}$.
  - Normal users can only deploy if their account has an assigned available slot ($\text{Active User VMs} < \text{Assigned Slots}$).
  - Admin can deploy and reassign slots at will.

#### 4. VPS Controls & Reinstall
- **Start / Stop / Restart**: Dispatches verified Docker container commands (`docker start`, `docker stop -t 5`, `docker restart -t 5`).
- **Reinstall**:
  - Prompts explicit confirmation dialog warning that container data will be erased.
  - Stops container, removes container instance, and recreates container using the original OS image tag while retaining assigned owner, IP address, SSH port, and resource limits.
- **Boot & Startup Logs**: Fetches real container logs via `docker logs --tail 100` and displays with timestamps and streaming updates.

#### 5. Interactive Root Web Console (xterm.js + WebSockets)
- Mounts WebSocket server on `/ws/console/:vmId`.
- Verifies session token and VM ownership before establishing stream.
- Spawns interactive bash/sh shell inside container via `docker exec -it <containerId> /bin/bash` (fallback `/bin/sh`).
- Relays terminal input, ANSI escape sequences, output buffers, and resize events (`cols`, `rows`).

#### 6. SSHX Terminal Integration
- Provides single-click action below the web console.
- Executes `sshx` client within the user's specific container: `docker exec <containerId> sshx`.
- Parses generated session URL (e.g., `https://sshx.io/s/...`) and returns it to the client.
- Displays copyable link, active status badge, and an option to terminate the session.

#### 7. Installation Automation (`install.sh` & `run.sh`)
- **`install.sh`**:
  - Root / sudo privilege verification.
  - Prerequisites check (git, curl).
  - Clones `https://github.com/baconzoro87-svg/DVM-PANEL.git` into `/opt/DVM-PANEL` (or updates existing without wiping data).
  - Automatically executes `run.sh`.
- **`run.sh`**:
  - Detects OS (Ubuntu 22.04, 24.04, Debian 12) and system architecture.
  - Installs/validates Node.js (v22), npm, PM2, and Docker Engine.
  - Installs npm packages; builds frontend (`npm run build`).
  - Initializes SQLite database and seeds default admin account.
  - Starts backend via PM2 (`pm2 start server.ts --name dvm-panel --interpreter tsx`).
  - Emits the professional BusterNodes completion banner containing live IP, ports, and management commands.

---

## 4. Verification & Testing Strategy

- **Automated API & Backend Tests**: Update `tests/api.test.ts` to test user authentication, password change enforcement, AutoDeploy slot validation, container lifecycle operations, and IDOR isolation.
- **Build & Lint Verification**: Execute `npm run build` and `npm run lint` (`tsc --noEmit`) to verify strict TypeScript adherence.
- **Installer Syntax Validation**: Validate shell scripts with `bash -n install.sh` and `bash -n run.sh`.
