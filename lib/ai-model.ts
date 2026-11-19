// The model every AI call in this product uses: the web assistant, the web NeuroOffice, and the
// app's assistant and NeuroOffice routes. One place, so that nothing can change the model in one
// route and leave the other three.
//
// What the privacy policy says about Anthropic (not used for training; deleted within 30 days by
// default; kept longer only if flagged by its safety systems) and what is entered in the App
// Privacy answers were checked for THIS model. Changing it means checking them again first, which
// is why lib/ai-model.test.mjs pins the value and fails on any other string that names a model
// anywhere else in the code.
//
// What no test can catch: a route to a model from ANOTHER provider. It would not use this constant
// and would not contain "claude-", and the data would go to someone the policy never mentions. If
// one is ever added, the privacy policy and the App Privacy answers have to be redone, and nothing
// will say so.
export const AI_MODEL = "claude-sonnet-5";
