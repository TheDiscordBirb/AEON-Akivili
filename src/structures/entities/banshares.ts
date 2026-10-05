import { Column, Entity, PrimaryColumn } from "typeorm";
import { encryptionManager } from "../../utils/data-encryption";

@Entity()
export class Banshares {
    @PrimaryColumn({ type: "text" })
    banshareUid: string
    @PrimaryColumn({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    serverId: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    status: string
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
    reason: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    proof: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return Number(encryptionManager.decrypt(value));
            },
            to(value: number) {
                return encryptionManager.encrypt(value.toString());
            },
        }})
    timestamp: number
}