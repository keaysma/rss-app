export const isolateClick = (onclick: () => unknown) => {
    return (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        onclick();
    }
}