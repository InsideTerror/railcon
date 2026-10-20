# C.O.R.E. - Corporation Of Railway Engineering

Full-stack train fleet operation, telemetry, and Passenger Information System (PIS) modeled after real-world transit telemetry systems.

## Architecture

- **Server**: Node.js + Fastify + TypeScript + Prisma + PostgreSQL + Socket.io
- **Client**: React + TypeScript + Tailwind CSS + Vite (PWA/Electron/Capacitor ready)
- **PIS**: Embedded HTTP server on each OBU device (port 8080)
- **Real-time**: WebSocket synchronization between OBU, PIS, and Dispatcher Dashboard

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm 10+

### Installation

