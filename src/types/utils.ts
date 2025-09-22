export interface ParsedEmoji {
    isAnimated: boolean,
    name: string,
    id: string
}

export interface ServerCooldowns {
    serverId: string,
    cooldowns: string[]
}