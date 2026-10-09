import "./globals.css";

export const metadata = {
  title: "Fridgey Smart Pantry",
  description: "Aplikasi pengelolaan stok bahan makanan untuk UMKM kuliner",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}