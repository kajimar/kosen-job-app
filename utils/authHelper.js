import supabase from "./supabaseClient";

// ユーザー情報を取得
export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// ログイン状態チェック
export const requireAuth = async (router) => {
  const user = await getUser();
  if (!user) {
    router.push("/auth");  // 未ログインならログインページへ
  }
};
