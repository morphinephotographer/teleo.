"""Generate deterministic, dependency-free Xcode project; no user settings touched."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]/'apps/apple'
def uid(s):return hashlib.sha256(s.encode()).hexdigest()[:24].upper()
objects={}
def add(name,body): objects[uid(name)]=body;return uid(name)
files=['Sources/TeleoCore/Domain.swift','Sources/TeleoCore/Storage.swift','Shared/NativeRemote.swift','Shared/TeleoApp.swift','Shared/Reader.swift']
refs=[add(f,'{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "'+f+'"; sourceTree = "<group>";}') for f in files]
products=[];targets=[];configs=[]
for name,os in [('Teleo-macOS','macosx'),('Teleo-iOS','iphoneos')]:
 prod=add(name+'product','{isa = PBXFileReference; explicitFileType = wrapper.application; path = "'+name+'.app"; sourceTree = BUILT_PRODUCTS_DIR;}');products.append(prod)
 builds=[add(name+f,'{isa = PBXBuildFile; fileRef = '+uid(f)+';}') for f in files]
 phase=add(name+'sources','{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+','.join(builds)+'); runOnlyForDeploymentPostprocessing = 0;}')
 conf=[]
 for config in ['Debug','Release']:
  settings={'PRODUCT_NAME':'"$(TARGET_NAME)"','PRODUCT_BUNDLE_IDENTIFIER':'cc.teleo.'+('mac' if os=='macosx' else 'ios'),'SDKROOT':os,'SWIFT_VERSION':'5.0','SWIFT_STRICT_CONCURRENCY':'complete','MACOSX_DEPLOYMENT_TARGET':'14.0','IPHONEOS_DEPLOYMENT_TARGET':'17.0','GENERATE_INFOPLIST_FILE':'YES','INFOPLIST_FILE':'Shared/Info.plist','INFOPLIST_KEY_CFBundleDisplayName':'"teleo."','INFOPLIST_KEY_NSLocalNetworkUsageDescription':'"Find and control your nearby Teleo Mac with your approval."','INFOPLIST_KEY_NSBonjourServices':'"_teleo._tcp"','CODE_SIGN_STYLE':'Automatic','ENABLE_APP_SANDBOX':'YES','CODE_SIGN_ENTITLEMENTS':'"Shared/'+('macOS' if os=='macosx' else 'iOS')+'.entitlements"','SWIFT_OPTIMIZATION_LEVEL':'"-Onone"' if config=='Debug' else '"-O"','SUPPORTED_PLATFORMS':'"macosx"' if os=='macosx' else '"iphoneos iphonesimulator"','TARGETED_DEVICE_FAMILY':'1','INFOPLIST_KEY_UILaunchScreen_Generation':'YES','INFOPLIST_KEY_UIApplicationSceneManifest_Generation':'YES'}
  conf.append(add(name+config,'{isa = XCBuildConfiguration; name = '+config+'; buildSettings = {'+''.join(k+' = '+v+';' for k,v in settings.items())+'};}'))
 cl=add(name+'configs','{isa = XCConfigurationList; buildConfigurations = ('+','.join(conf)+'); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;}')
 targets.append(add(name,'{isa = PBXNativeTarget; buildConfigurationList = '+cl+'; buildPhases = ('+phase+'); buildRules = (); dependencies = (); name = "'+name+'"; productName = "'+name+'"; productReference = '+prod+'; productType = "com.apple.product-type.application";}'))
for config in ['Debug','Release']:configs.append(add('project'+config,'{isa = XCBuildConfiguration; name = '+config+'; buildSettings = {CLANG_ENABLE_MODULES = YES;};}'))
cl=add('projectconfigs','{isa = XCConfigurationList; buildConfigurations = ('+','.join(configs)+'); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;}')
pg=add('products','{isa = PBXGroup; children = ('+','.join(products)+'); name = Products; sourceTree = "<group>";}')
g=add('group','{isa = PBXGroup; children = ('+','.join(refs+[pg])+'); sourceTree = "<group>";}')
# UI test targets use a separate in-memory launch mode, never the owner's library.
app_targets=list(targets)
for (name,os),app_target in zip([('Teleo-macOS','macosx'),('Teleo-iOS','iphoneos')],app_targets):
 testname=name+'UITests'
 ref=add(testname+'file','{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = \"Shared/TeleoUITests.swift\"; sourceTree = \"<group>\";}')
 build=add(testname+'build','{isa = PBXBuildFile; fileRef = '+ref+';}')
 phase=add(testname+'sources','{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+build+'); runOnlyForDeploymentPostprocessing = 0;}')
 product=add(testname+'product','{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = \"'+testname+'.xctest\"; sourceTree = BUILT_PRODUCTS_DIR;}')
 conf=[]
 for cfg in ['Debug','Release']:
  settings='PRODUCT_NAME = \"$(TARGET_NAME)\"; PRODUCT_BUNDLE_IDENTIFIER = cc.teleo.uitest.'+os+'; SDKROOT = '+os+'; SWIFT_VERSION = 5.0; MACOSX_DEPLOYMENT_TARGET = 14.0; IPHONEOS_DEPLOYMENT_TARGET = 17.0; GENERATE_INFOPLIST_FILE = YES; CODE_SIGN_STYLE = Automatic; TEST_TARGET_NAME = \"'+name+'\"; SUPPORTED_PLATFORMS = \"'+('macosx' if os=='macosx' else 'iphoneos iphonesimulator')+'\"; TARGETED_DEVICE_FAMILY = 1;'
  conf.append(add(testname+cfg,'{isa = XCBuildConfiguration; name = '+cfg+'; buildSettings = {'+settings+'};}'))
 cltest=add(testname+'configs','{isa = XCConfigurationList; buildConfigurations = ('+','.join(conf)+'); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;}')
 proxy=add(testname+'proxy','{isa = PBXContainerItemProxy; containerPortal = '+uid('project')+'; proxyType = 1; remoteGlobalIDString = '+app_target+'; remoteInfo = \"'+name+'\";}')
 dep=add(testname+'dep','{isa = PBXTargetDependency; target = '+app_target+'; targetProxy = '+proxy+';}')
 targets.append(add(testname,'{isa = PBXNativeTarget; buildConfigurationList = '+cltest+'; buildPhases = ('+phase+'); buildRules = (); dependencies = ('+dep+'); name = \"'+testname+'\"; productName = \"'+testname+'\"; productReference = '+product+'; productType = \"com.apple.product-type.bundle.ui-testing\";}'))
 refs.extend([ref,product])
 # Shared schemes explicitly include their UI tests.
 scheme=root/'Teleo.xcodeproj'/'xcshareddata'/'xcschemes';scheme.mkdir(parents=True,exist_ok=True)
 def br(target,label,ext):return '<BuildableReference BuildableIdentifier=\"primary\" BlueprintIdentifier=\"'+target+'\" BuildableName=\"'+label+ext+'\" BlueprintName=\"'+label+'\" ReferencedContainer=\"container:Teleo.xcodeproj\"/>'
 (scheme/(name+'.xcscheme')).write_text('<?xml version=\"1.0\"?><Scheme LastUpgradeVersion=\"2710\" version=\"1.3\"><BuildAction parallelizeBuildables=\"YES\" buildImplicitDependencies=\"YES\"><BuildActionEntries><BuildActionEntry buildForTesting=\"YES\" buildForRunning=\"YES\" buildForProfiling=\"YES\" buildForArchiving=\"YES\" buildForAnalyzing=\"YES\">'+br(app_target,name,'.app')+'</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration=\"Debug\" selectedDebuggerIdentifier=\"Xcode.DebuggerFoundation.Debugger.LLDB\" selectedLauncherIdentifier=\"Xcode.IDEFoundation.Launcher.LLDB\" shouldUseLaunchSchemeArgsEnv=\"YES\"><Testables><TestableReference skipped=\"NO\">'+br(uid(testname),testname,'.xctest')+'</TestableReference></Testables></TestAction><LaunchAction buildConfiguration=\"Debug\" selectedDebuggerIdentifier=\"Xcode.DebuggerFoundation.Debugger.LLDB\" selectedLauncherIdentifier=\"Xcode.IDEFoundation.Launcher.LLDB\" launchStyle=\"0\" useCustomWorkingDirectory=\"NO\" ignoresPersistentStateOnLaunch=\"NO\" debugDocumentVersioning=\"YES\"><BuildableProductRunnable runnableDebuggingMode=\"0\">'+br(app_target,name,'.app')+'</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration=\"Release\"/><AnalyzeAction buildConfiguration=\"Debug\"/><ArchiveAction buildConfiguration=\"Release\" revealArchiveInOrganizer=\"YES\"/></Scheme>')
objects[g]='{isa = PBXGroup; children = ('+','.join(refs+[pg])+'); sourceTree = \"<group>\";}'
p=add('project','{isa = PBXProject; attributes = {LastUpgradeCheck = 2710;}; buildConfigurationList = '+cl+'; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en,Base); mainGroup = '+g+'; productRefGroup = '+pg+'; projectDirPath = ""; projectRoot = ""; targets = ('+','.join(targets)+');}')
project=root/'Teleo.xcodeproj';project.mkdir(exist_ok=True)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+''.join(k+' = '+v+';\n' for k,v in objects.items())+'}; rootObject = '+p+';}\n')
# Explicit plist arrays avoid generated scalar Bonjour configuration.
import plistlib
for platform in ['macOS','iOS']:
 ent={'com.apple.security.app-sandbox':True,'com.apple.security.network.client':True,'com.apple.security.network.server':True,'com.apple.security.files.user-selected.read-write':True} if platform=='macOS' else {}
 (root/'Shared'/f'{platform}.entitlements').write_bytes(plistlib.dumps(ent))
