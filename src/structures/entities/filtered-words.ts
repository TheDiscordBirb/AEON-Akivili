import { Entity, PrimaryColumn } from "typeorm";

@Entity()
export class FilteredWords {
    @PrimaryColumn({ type: "text" })
    word: string
}