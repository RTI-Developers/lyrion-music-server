/// <reference no-default-lib="true"/>

/////////////////////////////
/// JSON — provided by json2.js polyfill (Crockford)
/// Declared separately so any RTI driver project that bundles json2.js
/// can include this file independently of es3.d.ts.
/////////////////////////////

interface JSON {
    parse(text: string, reviver?: (key: any, value: any) => any): any;
    stringify(value: any, replacer?: (key: string, value: any) => any, space?: string | number): string;
    stringify(value: any, replacer?: (number | string)[] | null, space?: string | number): string;
}

declare var JSON: JSON;
