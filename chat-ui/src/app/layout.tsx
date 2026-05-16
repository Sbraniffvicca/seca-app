import "antd/dist/reset.css"; // Import Ant Design styles
import "./globals.css"; // Keep your global CSS
import LayoutWrapper from "./LayoutWrapper"; // Client-side layout wrapper
import '@ant-design/v5-patch-for-react-19';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
