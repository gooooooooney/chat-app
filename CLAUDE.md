# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a full-stack chat application built with modern TypeScript stack featuring:
- **Frontend**: React Native (Expo) + Next.js web app
- **Backend**: Convex real-time database with better-auth integration
- **Architecture**: Turborepo monorepo with PNPM workspaces
- **State Management**: TanStack React Query + Convex integration
- **Features**: 1v1 & group chats, friend system, text & image messaging

## Project Structure
```
chat-app/
├── apps/
│   ├── web/         # Next.js web application
│   └── native/      # React Native/Expo mobile app
├── packages/
│   └── backend/     # Convex backend (schema, queries, mutations)
├── docs/            # Phase-based implementation documentation
├── turbo.json       # Turborepo configuration
└── package.json     # Root workspace configuration
```

## Technology Stack
- **Runtime**: Node.js with TypeScript ~5.9.2 (strict requirement for Convex)
- **Database**: Convex (real-time, serverless)
- **Authentication**: better-auth 1.3.8 with @convex-dev/better-auth 0.8.4
- **State Management**: TanStack React Query with @convex-dev/react-query
- **Build System**: Turborepo 2.5.4
- **Package Manager**: PNPM 10.17.1
- **Mobile**: React Native with Expo, NativeWind, rn-primitives
- **Web**: Next.js with TailwindCSS & radix-ui

## Development Commands

### Setup & Development
```bash
# Install dependencies
pnpm install

# Initial Convex setup (first time only)
pnpm dev:setup

# Start all apps in development
pnpm dev

# Start individual apps
pnpm dev:native    # React Native/Expo
pnpm dev:web       # Next.js web app
pnpm dev:server    # Convex backend only
```

### Build & Quality
```bash
# Build all packages
pnpm build

# Type checking
pnpm check-types

# Linting (if configured)
turbo lint
```

### Convex Specific
```bash
cd packages/backend
npx convex dev                    # Start Convex development server
npx convex dev --configure        # Reconfigure Convex project
npx convex deploy                 # Deploy to production
npx convex dashboard              # Open Convex dashboard
```

## Architecture Patterns

### 1. Query Pattern (TanStack React Query + Convex)
```typescript
// Standard query pattern
import { useQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@chat-app/backend/convex/_generated/api';

const { data, isPending, error } = useQuery(
  convexQuery(api.v1.module.function, params)
);
```

### 2. Mutation Pattern
```typescript
// Standard mutation pattern
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';

const { mutateAsync, isPending } = useMutation({
  mutationFn: useConvexMutation(api.v1.module.function)
});
```

### 3. API Organization
- **All API calls use `api.v1.**` format** (e.g., `api.v1.users.sendFriendRequest`)
- Never use generic `api.**` imports
- Specific API paths enforce clear module boundaries
- Backend functions organized in `/convex/v1/` directory

### 4. Friendship Data Model (Critical)
- **Normalized storage**: `const [user1Id, user2Id] = [userA, userB].sort()`
- Always store smaller userId as user1Id (dictionary ordering)
- Single record per friendship (not duplicate A→B and B→A)
- Query patterns require checking both user1Id and user2Id positions

## Core Database Schema

### Key Tables
- **userProfiles**: Extended user profiles with better-auth integration
- **conversations**: Direct and group chat support
- **conversationParticipants**: Membership with roles (owner/admin/member)
- **messages**: Text/image/file messaging with replies and threading
- **friendships**: Normalized friendship storage (see FRIENDSHIP_DESIGN.md)
- **friendRequests**: Complete friend request workflow

### Union Types (Schema Exports)
```typescript
// These are exported from schema.ts and used across the application
- PresenceStatus: "online" | "away" | "offline"
- ConversationType: "direct" | "group"
- MessageType: "text" | "image" | "file" | "system"
- FriendRequestStatus: "pending" | "accepted" | "rejected" | "cancelled"
```

## Mobile App Architecture

### Navigation Structure
```
app/
├── (app)/                    # Main authenticated app
│   ├── (authenticated)/     # Authenticated routes
│   │   ├── (tabs)/          # Bottom tab navigation
│   │   └── (pages)/         # Stack navigation for details
│   └── (auth)/              # Authentication flows
└── _layout.tsx              # Root layout with providers
```

### Key Providers Setup
```typescript
// Root layout provider hierarchy
<ConvexBetterAuthProvider>
  <QueryClientProvider>      // TanStack React Query
    <ThemeProvider>
      <GestureHandlerRootView>
        <KeyboardProvider>
          {/* App content */}
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  </QueryClientProvider>
</ConvexBetterAuthProvider>
```

## Component Architecture

### UI Components
- **Base**: rn-primitives (cross-platform React Native components)
- **Styling**: NativeWind (TailwindCSS for React Native)
- **Icons**: lucide-react-native
- **Layout**: Expo Router file-based routing

### Chat Components
- `ChatScreen`: Main chat interface with data transformation
- `ChatMessageList`: Optimized FlatList for performance
- `MessageBubble`: Individual message rendering
- `MessageInput`: Input with keyboard handling and attachment support

## Data Flow & State Management

### Convex Integration
- Real-time subscriptions via Convex
- Optimistic updates through TanStack React Query
- Automatic cache management and synchronization
- Built-in offline support and retry logic

### Type Safety
- Generated Convex types: `Doc<"tableName">`, `Id<"tableName">`
- Schema union types exported and reused
- TypeScript strict mode enabled across all packages

## Development Best Practices

### API Usage
```typescript
// ✅ Correct - Use specific API paths
const conversation = useQuery(
  convexQuery(api.v1.conversations.getConversationById, { conversationId, userId })
);

// ❌ Incorrect - Don't use generic imports
import { api } from '@chat-app/backend/convex/_generated/api';
```

### Friend System Queries
```typescript
// ✅ Correct - Handle normalized friendship data
const [user1Id, user2Id] = [currentUserId, targetUserId].sort();
const friendship = await ctx.db
  .query("friendships")
  .withIndex("by_users", (q) => q.eq("user1Id", user1Id).eq("user2Id", user2Id))
  .first();
```

### Component Optimization
```typescript
// ✅ Performance optimized FlatList for messages
<FlatList
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
  initialNumToRender={15}
  // ... other performance props
/>
```

## Debugging & Development

### Common Development Issues
- **TypeScript Version**: Must use ~5.9.2 (Convex compatibility requirement)
- **iOS Simulator**: Use `xcrun simctl erase all` for device ID issues
- **Environment Variables**: Managed through Convex dashboard

### Development Tools
- Convex dashboard for real-time data inspection
- Expo DevTools for mobile debugging
- Turborepo TUI for build monitoring
- TypeScript errors with exact file:line references

## Documentation Structure

Phase-based implementation docs in `/docs/`:
- `phase-1-backend-api.md`: Backend schema and API implementation
- `phase-2-ui-components.md`: React Native UI components
- `phase-3-chat-functionality.md`: Core chat features with TanStack patterns
- `phase-4-offline-sync.md`: Offline synchronization
- `phase-5-performance-optimization.md`: Performance improvements

## Security & Authentication

### Authentication Flow
- better-auth handles user authentication
- Convex integration via @convex-dev/better-auth
- Session management across web and mobile
- Secure user profile extensions in userProfiles table

### Data Security
- Friendship-based chat access control
- Input validation on custom user IDs (3-20 chars, alphanumeric + underscore)
- Convex built-in authorization patterns
- Real-time data with proper access controls

---

*This configuration reflects a production-ready chat application using modern React patterns with TanStack React Query + Convex integration.*