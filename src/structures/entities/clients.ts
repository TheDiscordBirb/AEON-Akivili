import { Column, Entity, PrimaryColumn } from "typeorm";
import { encryptionManager } from "../../utils/data-encryption";
import { ExtendedClientTypes } from "../../types/client";

@Entity()
export class Clients {
    @PrimaryColumn({ type: "text" })
    uid: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    clientId: string
    @Column({ type: "text" })
    type: ExtendedClientTypes
}