const config = {
	"title": "Template-Oracle",
	"SERVER_URL": "http://localhost:3000/response",
	"NODE_URL": "wss://kovan.infura.io/ws/v3/09323fc48925428bbae7cefd272dd0c1",
	"mnemonic" : "nothing clinic express blood success torch artefact fresh where fine define undo",
	"contractAddress": "0x0d3c8fe0c248ec9abb66603f6fae48d176193e2c",
	"contractABI": require("../contracts/MultiPartyOracle.json"),
	"STATUS_URL":"",
	"timeout": 180000,
	"aggregator": ""
}
export default config;