/**
 * @category core/base
 */

// store taint information
export class Taint {
    isTaint: boolean;
    taintSrc: string;
    constructor() {
        this.isTaint = false;
        this.taintSrc = "";
    }
}