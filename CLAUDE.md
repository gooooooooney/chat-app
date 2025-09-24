# Chat App - Claude Code Configuration

## Project Overview
This is a full-stack chat application built with modern TypeScript stack featuring:
- **Frontend**: React Native (Expo) + Next.js web app
- **Backend**: Convex real-time database with better-auth integration
- **Architecture**: Turborepo monorepo with PNPM workspaces
- **Features**: 1v1 & group chats, friend system, text & image messaging

## Project Structure
```
chat-app/
├── apps/
│   ├── web/         # Next.js web application
│   └── native/      # React Native/Expo mobile app
├── packages/
│   └── backend/     # Convex backend (schema, queries, mutations)
├── turbo.json       # Turborepo configuration
└── package.json     # Root workspace configuration
```

## Technology Stack
- **Runtime**: Node.js with TypeScript 5.9.2
- **Database**: Convex (real-time, serverless)
- **Authentication**: better-auth 1.3.8 with @convex-dev/better-auth 0.8.4
- **Build System**: Turborepo 2.5.4
- **Package Manager**: PNPM 10.17.1
- **Mobile**: React Native with Expo
- **Web**: Next.js with TailwindCSS & shadcn/ui

## Core Features Implemented

### 1. Database Schema (packages/backend/convex/schema.ts)
Complete chat application schema with:
- **userProfiles**: Extended user profiles with custom IDs for friend discovery
- **conversations**: Support for direct and group chats
- **conversationParticipants**: Member management with roles
- **messages**: Text/image/file messaging with replies
- **messageAttachments**: File storage interface
- **messageReadStatus**: Read receipts
- **friendRequests**: Friend request workflow
- **friendships**: Normalized friendship storage using dictionary ordering

### 2. Friend System (packages/backend/convex/users.ts)
- Custom user IDs (3-20 chars, letters/numbers/underscore only)
- Friend requests with pending/accepted/rejected/cancelled states
- Normalized friendship storage (user1Id ≤ user2Id alphabetically)
- Friend discovery by custom ID
- Complete friend management workflow

### 3. Chat System (packages/backend/convex/chat.ts)
- Real-time messaging with Convex
- Direct conversation creation between friends
- Message threading and replies
- Read status tracking
- Image attachment support (interface ready)

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

# Available but not configured
turbo lint         # Linting (if configured)
```

### Convex Specific
```bash
cd packages/backend
npx convex dev                    # Start Convex development server
npx convex dev --configure        # Reconfigure Convex project
npx convex deploy                 # Deploy to production
npx convex dashboard              # Open Convex dashboard
```

## Key Architecture Decisions

### 1. Friendship Data Model
- **Problem**: Avoid duplicate friendship records (A→B and B→A)
- **Solution**: Dictionary ordering - always store smaller userId as user1Id
- **Implementation**: `const [user1Id, user2Id] = [userA, userB].sort()`
- **Benefits**: Single source of truth, 50% storage reduction, simpler queries

### 2. Type Safety with Convex
- Uses `Doc<"tableName">` instead of manual interfaces
- Leverages `WithoutSystemFields<T>` for clean type exports
- Exported union types for reusability across functions

### 3. Custom User IDs
- Format: 3-20 characters, alphanumeric + underscore only
- Enables friend discovery without exposing internal database IDs
- Unique constraint enforced at database level

## File Structure & Key Files

### Backend (packages/backend/convex/)
- `schema.ts` - Complete database schema with exported union types
- `types.ts` - TypeScript type definitions using Convex native types
- `users.ts` - User management and friend system
- `chat.ts` - Chat functionality and conversation management
- `auth.ts` - better-auth integration (if exists)
- `FRIENDSHIP_DESIGN.md` - Detailed friendship system documentation

### Configuration Files
- `turbo.json` - Defines build tasks and dependencies
- `package.json` - Root workspace with development scripts
- `packages/backend/package.json` - Backend dependencies

## Environment & Authentication
- Uses better-auth for authentication
- Convex handles real-time database operations
- Environment variables managed through Convex dashboard
- Development vs production environments supported

## Testing & Quality Assurance
- TypeScript strict mode enabled
- Type checking via `pnpm check-types`
- No specific test framework configured yet
- Consider adding Jest/Vitest for unit tests
- Consider adding Playwright for E2E tests

## Performance Considerations
- Convex provides automatic real-time subscriptions
- Normalized friendship data reduces storage and query complexity
- Indexed queries for efficient friend lookups
- Turborepo caching for faster builds

## Security Best Practices
- better-auth handles authentication securely
- Friendship-based chat creation (users can only chat with friends)
- Input validation on custom user IDs
- Convex functions provide built-in authorization patterns

## Known Issues & Solutions
- **TypeScript Version**: Must use ~5.9.2 (not 5.8.3) for Convex compatibility
- **iOS Simulator**: Use `xcrun simctl erase all` if device ID issues occur
- **Environment Variables**: Remove NODE_ENV=production during development testing

## Next Steps / Recommendations
1. Add comprehensive test suite
2. Implement image upload with Convex file storage
3. Add push notifications for mobile app
4. Implement message search functionality
5. Add conversation archiving/deletion
6. Consider adding message encryption
7. Add admin panel for user management
8. Implement message reactions/emoji support

## Debugging & Development Tips
- Use Convex dashboard to view real-time data
- Check `turbo dev` output for all service logs
- Mobile debugging via Expo DevTools
- TypeScript errors show exact file:line references
- Convex functions auto-reload during development

---
*This configuration reflects a production-ready chat application architecture with modern TypeScript tooling and real-time capabilities.*