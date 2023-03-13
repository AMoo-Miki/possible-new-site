((window) => {
    const _phrases = new Map();
    const _keyMatcher = /{{(.+?)}}/g;
    const _serialize = (o, prefix = '') => {
        switch (o?.constructor.name) {
            case 'Array':
                for (let i = 0, len = o.length; i < len; i++)
                    _serialize(o[i], `${prefix}${prefix ? '.' : ''}${i}`);
                break;

            case 'Object':
                const keys = Object.keys(o);
                let i = keys.length;
                while (i--) {
                    _serialize(o[keys[i]], `${prefix}${prefix ? '.' : ''}${keys[i]}`);
                }
                break;

            case "String":
                _phrases.set(prefix, o);
                break;

            default:
                console.warn(`${prefix} has a non-string value.`);
        }
    };
    const _get = key => _phrases.get(key) ?? '';

    window.i18n = {
        add: _serialize,
        get: _get,
        translate: text => {
            while (true) {
                let unchanged = true;
                text = text.replace(_keyMatcher, (m, m1) => {
                    unchanged = false;
                    return _get(m1);
                });
                if (unchanged) break;
            }
            return text;
        },
        toJSON: () => {
            return Object.fromEntries(_phrases);
        }
    };
})(window);