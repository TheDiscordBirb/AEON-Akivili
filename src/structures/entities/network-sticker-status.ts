import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class NetworkStickerStatus {
    @PrimaryColumn({ type: "text" })
    guildId: string
    @Column({ type: "boolean" })
    status: boolean
}