import { Column, Entity, PrimaryColumn } from "typeorm";
import { encryptionManager } from "../../utils/data-encryption";

@Entity()
export class UserReactions {
    @PrimaryColumn({ type: "text" })
    reactionUid: string
    @PrimaryColumn({ type: "text" })
    messageUid: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    userId: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    reactionIdentifier: string
}