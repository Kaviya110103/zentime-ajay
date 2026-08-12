// // src/context/ClientContext.js
// import React, { createContext, useContext, useEffect, useState } from "react";

// const ClientContext = createContext();

// export const ClientProvider = ({ children }) => {
//   const [client, setClient] = useState(null);

//   // Load client from localStorage when app starts
//   useEffect(() => {
//     const storedClient = localStorage.getItem("ClientData");
//     if (storedClient) {
//       setClient(JSON.parse(storedClient));
//     }
//   }, []);

//   const login = (clientData) => {
//     localStorage.setItem("ClientData", JSON.stringify(clientData));
//     setClient(clientData);
//   };

//   const logout = () => {
//     localStorage.removeItem("ClientData");
//     setClient(null);
//   };

//   return (
//     <ClientContext.Provider value={{ client, login, logout }}>
//       {children}
//     </ClientContext.Provider>
//   );
// };

// export const useClient = () => useContext(ClientContext);

