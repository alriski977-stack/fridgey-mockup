import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = await getCurrentUser();

  return (
    <>
      <div className="topbar">
        <h1>Profil Akun</h1>
        <span className="user">
          {user ? user.phone : "Belum masuk"}
        </span>
      </div>

      {user ? (
        <ProfileForm user={user} />
      ) : (
        <div className="panel">
          <div style={{ padding: "18px 20px" }}>
            Anda belum masuk.{" "}
            <Link href="/login" className="btn" style={{ marginLeft: 8, padding: "6px 12px" }}>
              Masuk
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
