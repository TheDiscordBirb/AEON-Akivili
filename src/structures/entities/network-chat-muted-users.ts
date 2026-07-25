import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class NetworkChatMutedUsers {
    @PrimaryColumn({ type: "text" })
    userId: string
    @Column({ type: "text" })
    staffId: string
}