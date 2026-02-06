declare module 'ionicons' {
	export function addIcons(icons: Record<string, string>): void;

	export namespace Components {
		interface IonIcon {}
	}

	export namespace JSX {
		interface IonIcon {}
	}
}

declare module 'ionicons/icons';
