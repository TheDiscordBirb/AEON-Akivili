import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Banshares {
    @PrimaryColumn({ type: "text" })
    serverId: string
    @Column({ type: "text" })
    status: string
    @PrimaryColumn({ type: "text" })
    userId: string
    @PrimaryColumn({ type: "text" })
    reason: string
    @PrimaryColumn({ type: "text" })
    proof: string
    @PrimaryColumn({ type: "numeric" })
    timestamp: number
}