# Portfolio OS

My portfolio, styled as a Linux [Hyprland](https://hyprland.org/) desktop environment.

The site behaves like a desktop OS: navigate with a working terminal emulator or a Hyprland-style app launcher. Sections open as floating, draggable, resizable windows that snap to screen edges and corners like a real tiling window manager.

![Desktop with About, Projects, Themes, and Terminal windows open](docs/screenshots/desktop.png)

![Terminal window on first load](docs/screenshots/terminal.png)

## Features

- **Window manager**: drag, resize, focus, minimize, maximize. Drag a window to an edge or corner to tile it into a half or quadrant; double-click the title bar to un-snap.
- **Keyboard binds**: `Alt+Enter` terminal, `Alt+Q` close, `Alt+R` launcher, `Alt+1–5` workspaces (Alt stands in for Super, which the OS owns).
- **Workspaces**: five, each with its own windows. A terminal opens on first visit.
- **Terminal**: boots into `neofetch`. Tab completion, history with the arrow keys, `ls`, `cat`, `open`, and a few things you shouldn't type. `help` lists the rest.
- **Themes**: Parchment, Crimson, Nord, Gruvbox, Catppuccin Mocha, Tokyo Night, Rosé Pine Dawn. Remembered across visits.
- **Mobile**: below 768px it drops the window manager for a stacked layout.

## Tech stack

| Layer | Choice |
|-------|--------|
| Build tool | [Vite](https://vitejs.dev/) |
| Framework | React + TypeScript |
| Styling | Tailwind CSS (custom palette) |
| Animations | Framer Motion |
| Windows | react-rnd |
| Icons | lucide-react |
| Backend | None — fully static |

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Deployment

Planned: AWS S3 (static hosting) + CloudFront (CDN), mirrored to GitHub Pages.

## Links

- GitHub: [JordanCa0](https://github.com/JordanCa0)
- LinkedIn: [jordan-cao](https://www.linkedin.com/in/jordan-cao-585a76204/)
- Email: jordancao77@gmail.com
