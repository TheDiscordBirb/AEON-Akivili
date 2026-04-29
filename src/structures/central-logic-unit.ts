import { DataType, Data, ValidatedEventData, ValidatedCommandData, CommandTypes, EventTypes } from "../types/central-logic-unit";

class MainProcessingUnit {
    async processData(data: Data) {
        switch(data.type) {
            case DataType.COMMAND:
                await this.handleCommand(data);
                break;
            case DataType.EVENT:
                await this.handleEvent(data);
                break;
            default:
                throw new Error("Invalid data type.");
        }
    }


    async handleCommand(data: Data) {
        let validatedData: ValidatedCommandData;
        try {
            validatedData = await this.validateCommandData(data);
        } catch(e) {

        }
    }

    async validateCommandData(data: Data): Promise<ValidatedCommandData> {
        return {type: CommandTypes.DISCONNECT};
    }

    async handleEvent(data: Data) {
        let validatedData: ValidatedEventData;
        try {
            validatedData = await this.validateEventData(data);
        } catch(e) {

        }
    }

    async validateEventData(data: Data): Promise<ValidatedEventData> {
        return {type: EventTypes.READY};
    }
}

export const MPU = new MainProcessingUnit();