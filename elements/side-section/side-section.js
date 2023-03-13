class SideSection extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/side-section/side-section.html")).text());
    }
}

window.customElements.define('side-section', SideSection);