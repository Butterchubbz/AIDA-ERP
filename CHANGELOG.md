# Changelog

All notable changes to the AIDA-ERP platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-26

### Added
- **Unified ERP Operations**:
  - Inventory management for devices, components, accessories, and refurbished items.
  - Inbound and outbound shipment logistics with tracking and status history.
  - Amazon operations: purchase orders, variant management, FBA inventory sync, and outgoing queues.
  - RMA and return merchandise tracking, including EU returns workflows.
  - Demand forecasting engine with sales velocity modeling and stock threshold calculations.
  - E-commerce integration sync engine for WooCommerce and Shopify with encrypted credentials.
- **Interactive Setup Wizard**:
  - Zero-touch database bootstrapping: provisions PocketBase superuser securely from the browser without exposing admin consoles.
  - Automatic 64-character encryption key generation and persistent volume storage.
  - Automatic collection schema initialization and verification.
  - In-wizard initial application admin account creation with 0-record security gate.
  - Automated lock-down of setup routes once configuration is completed.
- **Workspace Modes**:
  - **Team Mode**: Multi-user collaboration with granular Role-Based Access Control (Admin, Manager, Staff, Viewer).
  - **Personal (Solo Operator) Mode**: Streamlined interface for single-operator technicians and refurbishers (activated via Solo mode or `owner@local.aida`).
- **Security & Hardening**:
  - PocketBase database isolated behind Express API; port 8090 bound to `127.0.0.1` by default.
  - Express-enforced session authentication, CSRF origin verification, and permission middleware.
  - Complete mutation audit trail recording diffs and login events with automated secret redaction.
  - Idempotent PocketBase migrations supporting clean upgrades from legacy databases.
- **Deployment**:
  - Docker Compose v2 configuration with health checks and dedicated persistent volumes.
  - Clean environment template (`.env.example`) with clear production guidelines.
