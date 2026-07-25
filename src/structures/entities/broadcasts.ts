import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Broadcasts {
    @Column({ type: "text" })
    channelId: string
    @Column({ type: "text" })
    channelType: string
    @PrimaryColumn({ type: "text" })
    webhookId: string
    @Column({ type: "text" })
    guildId: string
    @Column({ type: "text" })
    importantBanshareRoleId: string | null
    @Column({ type: "numeric" })
    autoBanLevel: number
    @Column({ type: "text" })
    serviceClientId: string
}