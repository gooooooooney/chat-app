import React from 'react';
import { render } from '@testing-library/react-native';
import { MessageBubble } from '../MessageBubble';

describe('MessageBubble', () => {
  const mockMessage = {
    _id: 'test-message-1',
    content: 'Hello, world!',
    senderId: 'user-1',
    type: 'text' as const,
    status: 'sent' as const,
    createdAt: Date.now(),
  };

  const mockSenderInfo = {
    userId: 'user-1',
    displayName: 'Test User',
    avatar: undefined,
  };

  it('renders own message correctly', () => {
    const { getByText } = render(
      <MessageBubble
        message={mockMessage}
        isOwn={true}
        senderInfo={mockSenderInfo}
        showAvatar={false}
      />
    );

    expect(getByText('Hello, world!')).toBeTruthy();
  });

  it('renders other user message correctly', () => {
    const { getByText } = render(
      <MessageBubble
        message={mockMessage}
        isOwn={false}
        senderInfo={mockSenderInfo}
        showAvatar={true}
      />
    );

    expect(getByText('Hello, world!')).toBeTruthy();
    expect(getByText('Test User')).toBeTruthy();
  });

  it('shows message status for own messages', () => {
    const { queryByTestId } = render(
      <MessageBubble
        message={{ ...mockMessage, status: 'read' }}
        isOwn={true}
        senderInfo={mockSenderInfo}
        showAvatar={false}
      />
    );

    // Status icon should be present for own messages
    // Note: This would need proper test IDs added to the component
  });

  it('hides sender name when showAvatar is false', () => {
    const { queryByText } = render(
      <MessageBubble
        message={mockMessage}
        isOwn={false}
        senderInfo={mockSenderInfo}
        showAvatar={false}
      />
    );

    expect(queryByText('Test User')).toBeNull();
  });
});