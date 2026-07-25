import { Entity, PrimaryColumn } from "typeorm";

@Entity()
export class UserReactions {
    @PrimaryColumn({ type: "text" })
    uniqueMessageId: string
    @PrimaryColumn({ type: "text" })
    userId: string
    @PrimaryColumn({ type: "text" })
    reactionIndentifier: string
}