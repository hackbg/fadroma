const init = ({ "default": x }) => x();
import('./comp/Editor.ts').then(init);
import('./comp/Platform.ts').then(init);
import('./net/chat.ts').then(init);
