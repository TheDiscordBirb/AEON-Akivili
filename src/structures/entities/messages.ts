import { Column, Entity, PrimaryColumn } from "typeorm";
import { encryptionManager } from "../../utils/data-encryption";

@Entity()
export class Messages {
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
    username: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    channelId: string
    @PrimaryColumn({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    discordMessageId: string
    @Column({ type: "text",
        transformer: {
            from(value: string) {
                return encryptionManager.decrypt(value);
            },
            to(value: string) {
                return encryptionManager.encrypt(value);
            },
        }})
    guildId: string
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
    @Column({ type: "boolean" })
    messageOrigin: boolean
}