class BigButton extends HTMLElement {
    static get observedAttributes() {
        return ['href'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (newValue === oldValue) return;

        this.shadowRoot.querySelector('a')?.setAttribute(name, newValue);
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/big-button/big-button.html")).text(), frag => {
            const a = frag.querySelector('a');
            if (!a) return;

            this.constructor.observedAttributes?.forEach(name => {
                a.setAttribute(name, this.getAttribute(name));
            });
        });
    }
}

window.customElements.define('big-button', BigButton);