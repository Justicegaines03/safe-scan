# Safe Scan - 3-Layer Architecture

## Overview

This document describes the new 3-layer architecture implemented in Safe Scan, following the Ultimate System Design principles.

## Architecture Layers

### 1. Presentation Layer (`/presentation`, `/components`)
**Responsibility:** UI only - displays data and captures user input

**Key Files:**
- `presentation/(tabs)/index.tsx` - Main scanner screen UI
- `presentation/(tabs)/explore.tsx` - History screen UI
- `components/*` - Reusable UI components

**Rules:**
- ✅ Render UI components
- ✅ Handle user interactions (button clicks, gestures)
- ✅ Display data from Application layer
- ❌ NO business logic
- ❌ NO direct API calls
- ❌ NO data calculations

### 2. Application Layer (`/application`)
**Responsibility:** Business logic only - platform-agnostic core logic

**Key Files:**
```
application/
├── interfaces/              # Contracts with Infrastructure layer
│   ├── IVirusTotalAPI.ts
│   ├── ICommunityService.ts
│   ├── IScanHistoryService.ts
│   └── IUserIdentityService.ts
├── scanners/
│   ├── QRScanner.ts        # Main QR scanning orchestrator
│   ├── URLValidator.ts     # URL validation logic
│   └── SafetyAssessor.ts   # Safety calculation logic
├── voting/
│   └── CommunityVoting.ts  # Community voting logic
└── ServiceContainer.ts     # Dependency injection container
```

**Rules:**
- ✅ Contains ALL business logic
- ✅ Platform-agnostic (no React Native dependencies)
- ✅ Testable without UI
- ✅ Uses interfaces to talk to Infrastructure layer
- ❌ NO UI code
- ❌ NO direct Firebase/API calls
- ❌ NO platform-specific code

### 3. Infrastructure Layer (`/infrastructure`)
**Responsibility:** External integrations - Firebase, APIs, storage

**Key Files:**
```
infrastructure/
├── adapters/                      # Adapters implementing Application interfaces
│   ├── FirebaseCommunityAdapter.ts
│   ├── FirebaseScanHistoryAdapter.ts
│   └── UserIdentityAdapter.ts
├── virustotal/
│   └── VirusTotalAPI.ts          # VirusTotal API integration
├── Firebase*.ts                   # Firebase service implementations
└── UserIdentityService.ts         # User identity management
```

**Rules:**
- ✅ Implements Application layer interfaces
- ✅ Handles external API calls
- ✅ Manages Firebase operations
- ✅ Handles data persistence
- ❌ NO business logic
- ❌ NO UI code

## Data Flow

```
User Interaction
    ↓
[Presentation Layer] - UI components
    ↓
[Application Layer] - Business Logic (QRScanner, SafetyAssessor, etc.)
    ↓
[Infrastructure Layer] - Firebase, VirusTotal, Storage
    ↓
External Services (Firebase, VirusTotal API)
```

## Dependency Injection

All services are configured in `ServiceContainer.ts`:

```typescript
const container = ServiceContainer.getInstance();

// Application layer receives dependencies via constructor
const scanner = container.qrScanner; // Already configured with all dependencies
```

**Benefits:**
- Easy to swap implementations (e.g., mock services for testing)
- Clear dependency graph
- Testable - mock interfaces in tests
- Single configuration point

## Folder Structure Overview

```
safe-scan/
├── presentation/          # Presentation Layer - UI components
│   ├── (tabs)/           # Tab-based screens (expo-router)
│   ├── _layout.tsx       # Root layout
│   └── settings.tsx      # Settings screen
├── application/           # Application Layer - Business logic
│   ├── interfaces/       # Contracts with Infrastructure layer
│   ├── scanners/         # QR scanning logic
│   ├── voting/           # Community voting logic
│   └── ServiceContainer.ts
├── infrastructure/        # Infrastructure Layer - External services
│   ├── adapters/         # Implement Application interfaces
│   ├── virustotal/       # VirusTotal API
│   └── Firebase*.ts      # Firebase services
└── components/            # Shared UI components
```

## Example Usage

### Before (Monolithic)
```typescript
// Everything in one 2000+ line component
const handleQRCodeScanned = async ({ data }) => {
  // URL validation
  // VirusTotal API call
  // Community rating fetch
  // Safety calculation
  // Save to AsyncStorage
  // Save to Firebase
  // Update UI
  // ...hundreds more lines
}
```

### After (3-Layer Architecture)
```typescript
// Presentation Layer - just UI
const handleQRCodeScanned = async ({ data }) => {
  const result = await scanner.validateQRCode(data);
  setValidationResult(result);
};

// Application Layer - business logic
class QRScanner {
  async validateQRCode(qrData: string) {
    const validated = this.urlValidator.validateHTTP(qrData);
    const [vtResult, community] = await Promise.all([
      this.virusTotalAPI.validateURL(validated),
      this.communityService.getCommunityRating(hash)
    ]);
    return this.safetyAssessor.calculateSafety(vtResult, community);
  }
}

// Infrastructure Layer - external calls
class VirusTotalAPI implements IVirusTotalAPI {
  async validateURL(url: string) {
    return await fetch('https://virustotal.com/api/...');
  }
}
```

## Benefits

### Code Organization
- **Clear separation of concerns** - each layer has one job
- **Reduced complexity** - smaller, focused files
- **Easier navigation** - know where to find code by its purpose

### Testability
- **Unit test Application layer** - no UI, no external dependencies
- **Mock Infrastructure layer** - test business logic in isolation
- **Integration test Infrastructure layer** - verify external integrations work

### Maintainability
- **Easy to change UI** - business logic stays the same
- **Easy to swap services** - change from Firebase to PostgreSQL? Just update Infrastructure layer
- **Platform portability** - reuse Application layer on web, desktop, etc.

### Future Scalability
- **Add features easily** - clear place for new business logic
- **Team collaboration** - different developers work on different layers
- **Code reuse** - Application layer can be used across platforms

## Next Steps

1. **Create presentation components** to break down the monolithic scanner UI
2. **Update scanner screen** to use the new architecture
3. **Add tests** following the logs-first approach
4. **Remove old backend services** once new architecture is proven

## Caching Strategy (To Be Decided)

The current implementation uses **AsyncStorage as a cache** for Firebase data:

**Pros:**
- Offline access to recent scans
- Faster initial load
- Fallback if Firebase is down

**Cons:**
- Data duplication
- Sync complexity
- Storage limits

**Options:**
1. **Keep AsyncStorage caching** - Better offline experience
2. **Remove AsyncStorage** - Simpler, rely 100% on Firebase
3. **Selective caching** - Only cache recent scans (last 10-20)

**Decision needed:** Review the `FirebaseScanHistoryAdapter` implementation and decide which approach fits your needs.
