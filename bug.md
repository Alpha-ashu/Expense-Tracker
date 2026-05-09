Update required 1 : I cant able to add bank accounts 

this is console error 
client:789 [vite] connecting...
client:912 [vite] connected.
react-dom.development.js:29895 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
api.ts:243 Fetch finished loading: PUT "http://localhost:9002/api/v1/auth/profile".
request @ api.ts:243
await in request
put @ api.ts:355
(anonymous) @ api.ts:450
(anonymous) @ AuthContext.tsx:433
await in (anonymous)
(anonymous) @ AuthContext.tsx:454
(anonymous) @ AuthContext.tsx:476
(anonymous) @ AuthContext.tsx:641
await in (anonymous)
(anonymous) @ AuthContext.tsx:657
(anonymous) @ GoTrueClient.ts:2754
_notifyAllSubscribers @ GoTrueClient.ts:2752
_recoverAndRefresh @ GoTrueClient.ts:2674
await in _recoverAndRefresh
_initialize @ GoTrueClient.ts:538
await in _initialize
(anonymous) @ GoTrueClient.ts:460
(anonymous) @ GoTrueClient.ts:1526
(anonymous) @ locks.ts:144
PINAuth.tsx:136 [Violation] 'setTimeout' handler took 251ms
pinService.ts:213 Fetch finished loading: POST "http://localhost:9002/api/v1/pin/verify".
post @ pinService.ts:213
await in post
verifyPin @ pinService.ts:338
(anonymous) @ PINAuth.tsx:186
setTimeout
(anonymous) @ PINAuth.tsx:129
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
commitRootImpl @ react-dom.development.js:26974
commitRoot @ react-dom.development.js:26721
performSyncWorkOnRoot @ react-dom.development.js:26156
flushSyncCallbacks @ react-dom.development.js:12042
(anonymous) @ react-dom.development.js:25690
api.ts:243  POST http://localhost:9002/api/v1/accounts 503 (Service Unavailable)
request @ api.ts:243
await in request
post @ api.ts:343
(anonymous) @ auth-sync-integration.ts:2253
(anonymous) @ AddAccount.tsx:224
callCallback @ react-dom.development.js:4164
invokeGuardedCallbackDev @ react-dom.development.js:4213
invokeGuardedCallback @ react-dom.development.js:4277
invokeGuardedCallbackAndCatchFirstError @ react-dom.development.js:4291
executeDispatch @ react-dom.development.js:9041
processDispatchQueueItemsInOrder @ react-dom.development.js:9073
processDispatchQueue @ react-dom.development.js:9086
dispatchEventsForPlugins @ react-dom.development.js:9097
(anonymous) @ react-dom.development.js:9288
batchedUpdates$1 @ react-dom.development.js:26179
batchedUpdates @ react-dom.development.js:3991
dispatchEventForPluginEventSystem @ react-dom.development.js:9287
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ react-dom.development.js:6465
dispatchEvent @ react-dom.development.js:6457
dispatchDiscreteEvent @ react-dom.development.js:6430
api.ts:57 [API Error] HTTP 503 | code=DATABASE_UNAVAILABLE | Database is temporarily unavailable. Please try again shortly.
getUserMessage @ api.ts:57
request @ api.ts:262
await in request
post @ api.ts:343
(anonymous) @ auth-sync-integration.ts:2253
(anonymous) @ AddAccount.tsx:224
callCallback @ react-dom.development.js:4164
invokeGuardedCallbackDev @ react-dom.development.js:4213
invokeGuardedCallback @ react-dom.development.js:4277
invokeGuardedCallbackAndCatchFirstError @ react-dom.development.js:4291
executeDispatch @ react-dom.development.js:9041
processDispatchQueueItemsInOrder @ react-dom.development.js:9073
processDispatchQueue @ react-dom.development.js:9086
dispatchEventsForPlugins @ react-dom.development.js:9097
(anonymous) @ react-dom.development.js:9288
batchedUpdates$1 @ react-dom.development.js:26179
batchedUpdates @ react-dom.development.js:3991
dispatchEventForPluginEventSystem @ react-dom.development.js:9287
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ react-dom.development.js:6465
dispatchEvent @ react-dom.development.js:6457
dispatchDiscreteEvent @ react-dom.development.js:6430
AddAccount.tsx:239 Failed to add account: APIError: Our servers are temporarily unavailable. Please try again in a moment.
    at HTTPClient.request (api.ts:287:19)
    at async saveAccountWithBackendSync (auth-sync-integration.ts:2253:22)
    at async handleSubmit (AddAccount.tsx:224:7)
(anonymous) @ AddAccount.tsx:239
await in (anonymous)
callCallback @ react-dom.development.js:4164
invokeGuardedCallbackDev @ react-dom.development.js:4213
invokeGuardedCallback @ react-dom.development.js:4277
invokeGuardedCallbackAndCatchFirstError @ react-dom.development.js:4291
executeDispatch @ react-dom.development.js:9041
processDispatchQueueItemsInOrder @ react-dom.development.js:9073
processDispatchQueue @ react-dom.development.js:9086
dispatchEventsForPlugins @ react-dom.development.js:9097
(anonymous) @ react-dom.development.js:9288
batchedUpdates$1 @ react-dom.development.js:26179
batchedUpdates @ react-dom.development.js:3991
dispatchEventForPluginEventSystem @ react-dom.development.js:9287
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ react-dom.development.js:6465
dispatchEvent @ react-dom.development.js:6457
dispatchDiscreteEvent @ react-dom.development.js:6430

api.ts:243 Fetch failed loading: POST "http://localhost:9002/api/v1/accounts".
request @ api.ts:243
await in request
post @ api.ts:343
(anonymous) @ auth-sync-integration.ts:2253
(anonymous) @ AddAccount.tsx:224
callCallback @ react-dom.development.js:4164
invokeGuardedCallbackDev @ react-dom.development.js:4213
invokeGuardedCallback @ react-dom.development.js:4277
invokeGuardedCallbackAndCatchFirstError @ react-dom.development.js:4291
executeDispatch @ react-dom.development.js:9041
processDispatchQueueItemsInOrder @ react-dom.development.js:9073
processDispatchQueue @ react-dom.development.js:9086
dispatchEventsForPlugins @ react-dom.development.js:9097
(anonymous) @ react-dom.development.js:9288
batchedUpdates$1 @ react-dom.development.js:26179
batchedUpdates @ react-dom.development.js:3991
dispatchEventForPluginEventSystem @ react-dom.development.js:9287
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ react-dom.development.js:6465
dispatchEvent @ react-dom.development.js:6457
dispatchDiscreteEvent @ react-dom.development.js:6430




Update required 2 :  I can't able to see the dashboard data 
Update required 3 :  loading issue when user switch or navigate to issue feature that time its loading and refresh the page need to slove this issue client:789 [vite] connecting...
client:912 [vite] connected.
react-dom.development.js:29895 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
api.ts:243 Fetch finished loading: PUT "http://localhost:9002/api/v1/auth/profile".
request @ api.ts:243
await in request
put @ api.ts:355
(anonymous) @ api.ts:450
(anonymous) @ AuthContext.tsx:433
await in (anonymous)
(anonymous) @ AuthContext.tsx:454
(anonymous) @ AuthContext.tsx:476
(anonymous) @ AuthContext.tsx:641
await in (anonymous)
(anonymous) @ AuthContext.tsx:657
(anonymous) @ GoTrueClient.ts:2754
_notifyAllSubscribers @ GoTrueClient.ts:2752
_recoverAndRefresh @ GoTrueClient.ts:2674
await in _recoverAndRefresh
_initialize @ GoTrueClient.ts:538
await in _initialize
(anonymous) @ GoTrueClient.ts:460
(anonymous) @ GoTrueClient.ts:1526
(anonymous) @ locks.ts:144
PINAuth.tsx:136 [Violation] 'setTimeout' handler took 184ms
pinService.ts:213 Fetch finished loading: POST "http://localhost:9002/api/v1/pin/verify".
post @ pinService.ts:213
await in post
verifyPin @ pinService.ts:338
(anonymous) @ PINAuth.tsx:186
setTimeout
(anonymous) @ PINAuth.tsx:129
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
commitRootImpl @ react-dom.development.js:26974
commitRoot @ react-dom.development.js:26721
performSyncWorkOnRoot @ react-dom.development.js:26156
flushSyncCallbacks @ react-dom.development.js:12042
(anonymous) @ react-dom.development.js:25690

Update required 4 : Failed to process receipt with any available model. Falling back to on-device OCR.

client:789 [vite] connecting...
client:912 [vite] connected.
react-dom.development.js:29895 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
api.ts:243 Fetch finished loading: PUT "http://localhost:9002/api/v1/auth/profile".
request @ api.ts:243
await in request
put @ api.ts:355
(anonymous) @ api.ts:450
(anonymous) @ AuthContext.tsx:433
await in (anonymous)
(anonymous) @ AuthContext.tsx:454
(anonymous) @ AuthContext.tsx:476
(anonymous) @ AuthContext.tsx:641
await in (anonymous)
(anonymous) @ AuthContext.tsx:657
(anonymous) @ GoTrueClient.ts:2754
_notifyAllSubscribers @ GoTrueClient.ts:2752
_recoverAndRefresh @ GoTrueClient.ts:2674
await in _recoverAndRefresh
_initialize @ GoTrueClient.ts:538
await in _initialize
(anonymous) @ GoTrueClient.ts:460
(anonymous) @ GoTrueClient.ts:1526
(anonymous) @ locks.ts:144
PINAuth.tsx:136 [Violation] 'setTimeout' handler took 184ms
pinService.ts:213 Fetch finished loading: POST "http://localhost:9002/api/v1/pin/verify".
post @ pinService.ts:213
await in post
verifyPin @ pinService.ts:338
(anonymous) @ PINAuth.tsx:186
setTimeout
(anonymous) @ PINAuth.tsx:129
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
commitRootImpl @ react-dom.development.js:26974
commitRoot @ react-dom.development.js:26721
performSyncWorkOnRoot @ react-dom.development.js:26156
flushSyncCallbacks @ react-dom.development.js:12042
(anonymous) @ react-dom.development.js:25690
cloudReceiptScanService.ts:136 Fetch finished loading: POST "http://localhost:9002/api/v1/receipts/start".
(anonymous) @ cloudReceiptScanService.ts:136
await in (anonymous)
(anonymous) @ useReceiptScanner.ts:96
await in (anonymous)
(anonymous) @ ReceiptScanner.tsx:87
callCallback @ react-dom.development.js:4164
invokeGuardedCallbackDev @ react-dom.development.js:4213
invokeGuardedCallback @ react-dom.development.js:4277
invokeGuardedCallbackAndCatchFirstError @ react-dom.development.js:4291
executeDispatch @ react-dom.development.js:9041
processDispatchQueueItemsInOrder @ react-dom.development.js:9073
processDispatchQueue @ react-dom.development.js:9086
dispatchEventsForPlugins @ react-dom.development.js:9097
(anonymous) @ react-dom.development.js:9288
batchedUpdates$1 @ react-dom.development.js:26179
batchedUpdates @ react-dom.development.js:3991
dispatchEventForPluginEventSystem @ react-dom.development.js:9287
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ react-dom.development.js:6465
dispatchEvent @ react-dom.development.js:6457
dispatchDiscreteEvent @ react-dom.development.js:6430
[Violation] Forced reflow while executing JavaScript took 34ms


its not working please check the logic behind it and fix the issue details are not showing properly after extraction of details into in the recepit and processing is also not happening properly and also it timing so much time to get extraction detaion from image to app and on the other hand in cloud it is not showing the full details as extracted and also total amount mismatch 
Bill total mismatch: calculated INR 70.31 vs printed INR 59.00. Please verify before saving.
Please review the extracted data

Confidence: 73% - edit any field if needed

Bill total mismatch detected

Calculated from items + taxes: INR 70.31 vs printed total: INR 59.00. Please verify the amount before saving.

but actual total is 70.31
client:789 [vite] connecting...
client:912 [vite] connected.
react-dom.development.js:29895 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
Fetch finished loading: GET "<URL>".
api.ts:243 Fetch finished loading: PUT "http://localhost:9002/api/v1/auth/profile".
request @ api.ts:243
await in request
put @ api.ts:355
(anonymous) @ api.ts:450
(anonymous) @ AuthContext.tsx:433
await in (anonymous)
(anonymous) @ AuthContext.tsx:454
(anonymous) @ AuthContext.tsx:476
(anonymous) @ AuthContext.tsx:641
await in (anonymous)
(anonymous) @ AuthContext.tsx:657
(anonymous) @ GoTrueClient.ts:2754
_notifyAllSubscribers @ GoTrueClient.ts:2752
_recoverAndRefresh @ GoTrueClient.ts:2674
await in _recoverAndRefresh
_initialize @ GoTrueClient.ts:538
await in _initialize
(anonymous) @ GoTrueClient.ts:460
(anonymous) @ GoTrueClient.ts:1526
(anonymous) @ locks.ts:144
PINAuth.tsx:136 [Violation] 'setTimeout' handler took 184ms
pinService.ts:213 Fetch finished loading: POST "http://localhost:9002/api/v1/pin/verify".
post @ pinService.ts:213
await in post
verifyPin @ pinService.ts:338
(anonymous) @ PINAuth.tsx:186
setTimeout
(anonymous) @ PINAuth.tsx:129
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
commitRootImpl @ react-dom.development.js:26974
commitRoot @ react-dom.development.js:26721
performSyncWorkOnRoot @ react-dom.development.js:26156
flushSyncCallbacks @ react-dom.development.js:12042
(anonymous) @ react-dom.development.js:25690
cloudReceiptScanService.ts:136 Fetch finished loading: POST "http://localhost:9002/api/v1/receipts/start".
(anonymous) @ cloudReceiptScanService.ts:136
await in (anonymous)
(anonymous) @ useReceiptScanner.ts:96
await in (anonymous)
(anonymous) @ ReceiptScanner.tsx:87
callCallback @ react-dom.development.js:4164
invokeGuardedCallbackDev @ react-dom.development.js:4213
invokeGuardedCallback @ react-dom.development.js:4277
invokeGuardedCallbackAndCatchFirstError @ react-dom.development.js:4291
executeDispatch @ react-dom.development.js:9041
processDispatchQueueItemsInOrder @ react-dom.development.js:9073
processDispatchQueue @ react-dom.development.js:9086
dispatchEventsForPlugins @ react-dom.development.js:9097
(anonymous) @ react-dom.development.js:9288
batchedUpdates$1 @ react-dom.development.js:26179
batchedUpdates @ react-dom.development.js:3991
dispatchEventForPluginEventSystem @ react-dom.development.js:9287
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ react-dom.development.js:6465
dispatchEvent @ react-dom.development.js:6457
dispatchDiscreteEvent @ react-dom.development.js:6430
[Violation] Forced reflow while executing JavaScript took 34ms
cloudReceiptScanService.ts:136 Fetch finished loading: POST "http://localhost:9002/api/v1/receipts/start".
(anonymous) @ cloudReceiptScanService.ts:136
await in (anonymous)
(anonymous) @ useReceiptScanner.ts:96
await in (anonymous)
(anonymous) @ ReceiptScanner.tsx:87
callCallback @ react-dom.development.js:4164
invokeGuardedCallbackDev @ react-dom.development.js:4213
invokeGuardedCallback @ react-dom.development.js:4277
invokeGuardedCallbackAndCatchFirstError @ react-dom.development.js:4291
executeDispatch @ react-dom.development.js:9041
processDispatchQueueItemsInOrder @ react-dom.development.js:9073
processDispatchQueue @ react-dom.development.js:9086
dispatchEventsForPlugins @ react-dom.development.js:9097
(anonymous) @ react-dom.development.js:9288
batchedUpdates$1 @ react-dom.development.js:26179
batchedUpdates @ react-dom.development.js:3991
dispatchEventForPluginEventSystem @ react-dom.development.js:9287
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ react-dom.development.js:6465
dispatchEvent @ react-dom.development.js:6457
dispatchDiscreteEvent @ react-dom.development.js:6430

Update required 5 :  book advisor feature is not created fully end to end and for both role user and advisor role and admin 

update required 6 : admin role is not fully created and its features are not implemented fully and also enable and disable users account and as well as for the advisor role etc 

Update required 7 : make the proper database schema for the all the features and implement them in the backend and frontend accordingly 

update required 8 : design the forntend ui /ux design based on the skill.md keep it in tact with all necessary design requered for all feature and for all roles and implement them in the frontend accordingly 

update required 9 : make the UI responsive for all the devices

update required 10 : make the UI fast and efficient and bug free

update required 11 : implement the authentication for all the features 

update required 12 : for user book appointment for book advisor and book advisor client ui / ux design is not created 

