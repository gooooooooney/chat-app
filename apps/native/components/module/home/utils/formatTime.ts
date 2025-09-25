/**
 * 格式化时间显示
 * @param lastMessageTime 最后消息时间（毫秒时间戳）
 * @returns 格式化后的时间字符串
 */
export const formatTime = (lastMessageTime: number): string => {
	const now = Date.now();
	const diffMs = now - lastMessageTime;
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) {
		return "刚刚";
	} else if (diffMinutes < 60) {
		return `${diffMinutes}分钟前`;
	} else if (diffHours < 24) {
		return `${diffHours}小时前`;
	} else if (diffDays < 7) {
		return `${diffDays}天前`;
	} else {
		const date = new Date(lastMessageTime);
		return `${date.getMonth() + 1}/${date.getDate()}`;
	}
};