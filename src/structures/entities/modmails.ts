import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Modmails {
    @Column({ type: "text" })
    userId: string
    @PrimaryColumn({ type: "text" })
    channelId: string
    @Column({ type: "boolean" })
    active: boolean
}