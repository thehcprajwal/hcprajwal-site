/** Remembers the commands typed, so the up and down arrows can recall them. */
export function createHistory(max = 80) {
    const items = [];
    let index = -1;

    return {
        add(cmd) {
            if (items[0] !== cmd) items.unshift(cmd);
            if (items.length > max) items.pop();
            index = -1;
        },
        /** Older command (arrow up), or null when there is none. */
        older() {
            if (index < items.length - 1) return items[++index];
            return null;
        },
        /** Newer command (arrow down). Empty string once you are back at the prompt. */
        newer() {
            index = index > 0 ? index - 1 : -1;
            return index >= 0 ? items[index] : '';
        },
    };
}
