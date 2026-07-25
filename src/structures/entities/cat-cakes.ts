import { Entity, PrimaryColumn } from "typeorm";
import { CatCakeTypes, Regions } from "../../types/command";

@Entity()
export class CatCakes {
    @PrimaryColumn({ type: "text" })
    uid: string
    @PrimaryColumn({ type: "text" })
    region: Regions
    @PrimaryColumn({ type: "text" })
    catType: CatCakeTypes
}