import * as MobX from 'mobx';

export class HighlightArea {
	@MobX.observable public bottom: number = 0;
	@MobX.observable public height: number = 0;
	@MobX.observable public isVisible: boolean = false;
	@MobX.observable public left: number = 0;
	@MobX.observable public opacity: number = 0;
	@MobX.observable public right: number = 0;
	@MobX.observable public top: number = 0;
	@MobX.observable public width: number = 0;

	@MobX.action
	public hide(): void {
		this.opacity = 0;
		this.isVisible = false;
	}

	@MobX.action
	public setSize(element: Element): void {
		const clientRect: ClientRect = element.getBoundingClientRect();
		this.bottom = clientRect.bottom;
		this.height = clientRect.height;
		this.left = clientRect.left + window.scrollX;
		this.right = clientRect.right;
		this.top = clientRect.top + window.scrollY;
		this.width = clientRect.width;
	}

	@MobX.action
	public show(): void {
		this.opacity = 1;
		this.isVisible = true;
	}
}
