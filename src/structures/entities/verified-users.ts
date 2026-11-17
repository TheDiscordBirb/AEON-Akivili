import { Column, Entity, PrimaryColumn } from "typeorm";
import { encryptionManager } from "../../utils/data-encryption";

@Entity()
export class VerifiedUsers {
    @PrimaryColumn({ type: "text" })
    verifiedUserUid: string
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
    @Column({ type: "text" })
    agreed: boolean
    @Column({ type: "text" })
    timestamp: string
}