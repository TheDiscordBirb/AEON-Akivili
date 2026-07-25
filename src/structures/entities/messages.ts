import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Messages {
    @PrimaryColumn({ type: "text" })
    userId: string
    @PrimaryColumn({ type: "text" })
    uniqueMessageId: string
    @Column({ type: "text" })
    username: string
    @Column({ type: "text" })
    channelId: string
    @PrimaryColumn({ type: "text" })
    channelMessageId: string
    @Column({ type: "text" })
    guildId: string
    @Column({ type: "numeric" })
    timestamp: number
    @Column({ type: "boolean" })
    messageOrigin: boolean
}