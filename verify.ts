import argon2 from "argon2";
(async () => {
  const hash = "$argon2id$v=19$m=65536,t=3,p=4$Q8sGULkKPwp2YQGy1DoLqA$57Oar6JfV6pNhGlS667wZr+xXa58v+iJr4pdn/eELEo";
  console.log(await argon2.verify(hash, "Teste1234"));
})();
