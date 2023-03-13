class RightAsideLayout extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/right-aside-layout/right-aside-layout.html")).text());
    }
}

window.customElements.define('right-aside-layout', RightAsideLayout);