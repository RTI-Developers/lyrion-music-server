class GlobalHandlerMap<T> {
    private readonly _handlesToValues: { [handle: string]: T; } = {};

    private count: number = 0;

    public getMappedValueFromHandle(handle: number): T | null {
        if (handle.toString() in this._handlesToValues) {
            return this._handlesToValues[handle.toString()];
        } else {
            return null;
        }
    }

    public register(handle: number, mappedValue: T) {
        this._handlesToValues[handle.toString()] = mappedValue;
        this.count++;
    }

    public remove(handle: number) {
        delete this._handlesToValues[handle.toString()];
        this.count--;
    }
}
