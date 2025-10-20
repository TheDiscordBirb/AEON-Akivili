import { Logger } from "../logger";
import { FilterOutput } from "../types/message-filter";
import { FilteredWords } from "../types/database";

const logger = new Logger("MsgFilter");

class MessageFilter {
    protected filterArray : string[] = [];

    public async addToFilterArray(list: FilteredWords[]) {
        list.map((filteredWord) => {
            this.filterArray.push(...this.getEveryVariationOfWord(filteredWord.word.toString().toLowerCase()));
        })
    }

    public getEveryVariationOfWord(word: string): string[] {
        const charArray = word.split('');
        const filteredCharArray = charArray.filter((char) =>
            char === "a" ||
            char === "i" ||
            char === "l" ||
            char === "o" ||
            char === "b" ||
            char === "g"
        )
        const totalVariations = Math.pow(2, filteredCharArray.length);

        const result : string[] = [];
        for(let i = 0; i < totalVariations; i++) {
            let template = i.toString(2);
            const missingZeros = Array(totalVariations.toString(2).length - template.length).join("0");
            template = missingZeros + template;
            let wordArgs = word.split("");
            wordArgs.map((value, idx) => {
                if(filteredCharArray.find((filter) => filter === value)) {
                    if(template[0] === "0") {
                        template = template.slice(1);
                        return;
                    } else {
                        switch(filteredCharArray.find((filter) => filter === value)) {
                            case "a":
                                wordArgs[idx] = "@";
                                break;
                            case "b":
                                wordArgs[idx] = "8";
                                break;
                            case "g":
                                wordArgs[idx] = "9";
                                break;
                            case "i":
                                wordArgs[idx] = "l";
                                break;
                            case "l":
                                wordArgs[idx] = "1";
                                break;
                            case "o":
                                wordArgs[idx] = "0";
                                break;     
                        }
                        template = template.slice(1);
                    }
                }
            })
            result.push(wordArgs.join().replaceAll(",", ""));
        }
        return result;
    }

    public async filterMessage(content: string): Promise<FilterOutput> {
        const filteredWords : string[] = [];
        this.filterArray.forEach((filterWord) => {
            if(content.includes(filterWord)) {
                filteredWords.push(filterWord);
            }
        })
        if(filteredWords.length) {
            return {resultClean: false, detectedFilteredContent: filteredWords};
        }
        return {resultClean: true};
    }

}

export const messageFilter = new MessageFilter();